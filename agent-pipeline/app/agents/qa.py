from __future__ import annotations

import logging

from cursor_sdk import AsyncClient, CursorAgentError

from app.agents.common import (
    format_startup_error,
    raise_if_failed,
    run_cloud_agent,
)
from app.config import Settings, load_prompt
from app.store import Store

logger = logging.getLogger(__name__)


async def run_qa_stage(
    client: AsyncClient,
    settings: Settings,
    store: Store,
    run_id: str,
    *,
    retest: bool = False,
) -> None:
    run = store.get_run(run_id)
    if run is None:
        raise KeyError(run_id)
    if not run.pr_url:
        raise RuntimeError(f"run {run_id} has no pr_url; cannot start QA")

    store.update_run(run_id, status="qa_running", last_error="")
    attempt = run.attempt + 1
    store.update_run(run_id, attempt=attempt)

    prompt = load_prompt("qa.md").format(
        pr_url=run.pr_url,
        jira_key=run.jira_key,
        retest="true" if retest else "false",
    )
    env: dict[str, str] = {}
    if settings.github_token:
        env["GITHUB_TOKEN"] = settings.github_token

    async def _persist_agent(aid: str) -> None:
        store.update_run(run_id, qa_agent_id=aid)

    try:
        agent_id, result = await run_cloud_agent(
            client,
            settings,
            prompt=prompt,
            metadata={
                "stage": "qa",
                "jira_key": run.jira_key,
                "pipeline_run_id": run_id,
                "pr_url": run.pr_url,
                "retest": "true" if retest else "false",
            },
            idempotency_key=f"pipeline:{run_id}:qa:{attempt}",
            name=f"qa-{run.jira_key}-{attempt}-{run_id[:8]}",
            env_vars=env or None,
            pr_url=run.pr_url,
            work_on_current_branch=True,
            on_agent_created=_persist_agent,
        )
        raise_if_failed(result, label="qa")
    except (CursorAgentError, RuntimeError, Exception) as err:
        msg = format_startup_error(err)
        logger.exception("qa cloud agent failed run_id=%s", run_id)
        store.update_run(run_id, status="failed", last_error=msg)
        raise

    store.update_run(
        run_id,
        status="qa_done",
        qa_agent_id=agent_id,
        last_error="",
    )
    logger.info("qa stage complete run_id=%s pr_url=%s retest=%s", run_id, run.pr_url, retest)
