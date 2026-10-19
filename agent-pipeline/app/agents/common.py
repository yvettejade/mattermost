from __future__ import annotations

import asyncio
import logging
import re
from collections.abc import Awaitable, Callable
from typing import Any

from cursor_sdk import (
    AsyncClient,
    CloudAgentOptions,
    CloudRepository,
    CursorAgentError,
    RunResult,
)

from app.config import Settings

logger = logging.getLogger(__name__)

PR_URL_RE = re.compile(r"https://github\.com/[^/\s]+/[^/\s]+/pull/\d+")
_WAIT_ATTEMPTS = 6
_WAIT_BASE_DELAY_SECONDS = 20
CLOUD_AGENT_URL_PREFIX = "https://cursor.com/agents/"


def cloud_agent_url(agent_id: str | None) -> str:
    """Web URL for a cloud agent session (bc-…). Empty for local / missing ids."""
    if not agent_id or not agent_id.startswith("bc-"):
        return ""
    return f"{CLOUD_AGENT_URL_PREFIX}{agent_id}"


def jira_env(settings: Settings) -> dict[str, str]:
    env: dict[str, str] = {}
    if settings.jira_base_url:
        env["JIRA_BASE_URL"] = settings.jira_base_url
    if settings.jira_email:
        env["JIRA_EMAIL"] = settings.jira_email
    if settings.jira_api_token:
        env["JIRA_API_TOKEN"] = settings.jira_api_token
    return env


def extract_pr_url_from_result(result: RunResult | Any, text: str = "") -> str:
    git = getattr(result, "git", None)
    branches = getattr(git, "branches", None) if git is not None else None
    if branches:
        for branch in branches:
            pr_url = getattr(branch, "pr_url", None)
            if isinstance(pr_url, str) and pr_url:
                return pr_url
    blob = text or str(getattr(result, "result", "") or "")
    for line in blob.splitlines():
        stripped = line.strip()
        if stripped.startswith("PR_URL:"):
            return stripped.split(":", 1)[1].strip()
    match = PR_URL_RE.search(blob)
    return match.group(0) if match else ""


def raise_if_failed(result: RunResult, *, label: str) -> None:
    if result.status == "finished":
        return
    run_id = getattr(result, "id", "") or ""
    raise RuntimeError(f"{label} run ended with status={result.status} id={run_id}")


def format_startup_error(err: BaseException) -> str:
    if isinstance(err, CursorAgentError):
        retryable = getattr(err, "is_retryable", None)
        return f"CursorAgentError: {err} retryable={retryable}"
    return f"{type(err).__name__}: {err}"


async def wait_run_result(
    client: AsyncClient,
    run: Any,
    *,
    attempts: int = _WAIT_ATTEMPTS,
    base_delay_seconds: float = _WAIT_BASE_DELAY_SECONDS,
) -> RunResult:
    """Wait for a run; retry bridge ReadTimeouts (retryable) with backoff."""
    run_id = getattr(run, "id", None) or str(run)
    last_err: BaseException | None = None
    for attempt in range(1, attempts + 1):
        try:
            if attempt == 1 and hasattr(run, "wait"):
                return await run.wait()
            return await client.wait_live_run(run_id)
        except CursorAgentError as err:
            last_err = err
            if not getattr(err, "is_retryable", False):
                raise
            delay = base_delay_seconds * attempt
            logger.warning(
                "bridge wait timed out attempt=%s/%s run_id=%s; retry in %ss: %s",
                attempt,
                attempts,
                run_id,
                delay,
                err,
            )
            if attempt >= attempts:
                break
            await asyncio.sleep(delay)
    assert last_err is not None
    raise last_err


async def run_cloud_agent(
    client: AsyncClient,
    settings: Settings,
    *,
    prompt: str,
    metadata: dict[str, str],
    idempotency_key: str,
    name: str,
    env_vars: dict[str, str] | None = None,
    auto_create_pr: bool = False,
    pr_url: str | None = None,
    work_on_current_branch: bool | None = None,
    on_agent_created: Callable[[str], Awaitable[None] | None] | None = None,
) -> tuple[str, RunResult]:
    """Create a cloud agent, send one prompt, wait for the terminal result."""
    repo = CloudRepository(
        url=settings.repo_url,
        starting_ref=None if pr_url else settings.github_default_branch,
        pr_url=pr_url,
    )
    cloud = CloudAgentOptions(
        repos=[repo],
        auto_create_pr=auto_create_pr,
        skip_reviewer_request=True if auto_create_pr else None,
        work_on_current_branch=work_on_current_branch,
        env_vars=env_vars or None,
        metadata=metadata,
    )
    agent_id = ""
    cloud_run_id = ""
    try:
        async with await client.create_agent(
            model=settings.cursor_model,
            api_key=settings.cursor_api_key,
            name=name,
            cloud=cloud,
            idempotency_key=idempotency_key,
        ) as agent:
            agent_id = agent.agent_id
            logger.info(
                "cloud agent created name=%s agent_id=%s url=%s",
                name,
                agent_id,
                cloud_agent_url(agent_id) or "(local)",
            )
            if on_agent_created is not None:
                maybe = on_agent_created(agent_id)
                if maybe is not None:
                    await maybe
            run = await agent.send(prompt)
            cloud_run_id = run.id
            logger.info(
                "cloud run started name=%s agent_id=%s run_id=%s",
                name,
                agent_id,
                cloud_run_id,
            )
            result = await wait_run_result(client, run)
            return agent_id, result
    except CursorAgentError as err:
        # Context manager may have closed; cloud run can still be alive.
        if cloud_run_id and getattr(err, "is_retryable", False):
            logger.warning(
                "wait failed after agent context closed; polling run_id=%s",
                cloud_run_id,
            )
            result = await wait_run_result(client, cloud_run_id)
            return agent_id, result
        raise
