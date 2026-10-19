from __future__ import annotations

import logging

from cursor_sdk import AsyncClient, CursorAgentError

from app.agents.common import (
    extract_pr_url_from_result,
    format_startup_error,
    jira_env,
    raise_if_failed,
    run_cloud_agent,
)
from app.config import Settings, load_prompt
from app.integrations.github_client import GitHubClient
from app.integrations.jira_client import JiraClient
from app.store import Store

logger = logging.getLogger(__name__)


async def run_implement_stage(
    client: AsyncClient,
    settings: Settings,
    store: Store,
    run_id: str,
) -> str:
    run = store.get_run(run_id)
    if run is None:
        raise KeyError(run_id)

    store.update_run(run_id, status="implement_running", last_error="")
    attempt = run.attempt + 1
    store.update_run(run_id, attempt=attempt)

    prd_text = run.prd_text or "(read from Jira)"
    prompt = load_prompt("implement.md").format(
        jira_key=run.jira_key,
        prd_text=prd_text,
    )
    env = jira_env(settings)
    if settings.slack_webhook_url:
        env["SLACK_WEBHOOK_URL"] = settings.slack_webhook_url

    async def _persist_agent(aid: str) -> None:
        store.update_run(run_id, implement_agent_id=aid)

    try:
        agent_id, result = await run_cloud_agent(
            client,
            settings,
            prompt=prompt,
            metadata={
                "stage": "implement",
                "jira_key": run.jira_key,
                "pipeline_run_id": run_id,
            },
            idempotency_key=f"pipeline:{run_id}:implement:{attempt}",
            name=f"implement-{run.jira_key}-{attempt}-{run_id[:8]}",
            env_vars=env,
            auto_create_pr=True,
            on_agent_created=_persist_agent,
        )
        raise_if_failed(result, label="implement")
    except (CursorAgentError, RuntimeError, Exception) as err:
        msg = format_startup_error(err)
        logger.exception("implement startup failed run_id=%s", run_id)
        store.update_run(run_id, status="failed", last_error=msg)
        raise

    text = getattr(result, "result", None)
    text_str = text if isinstance(text, str) else ""
    pr_url = extract_pr_url_from_result(result, text_str)
    if not pr_url:
        msg = "implement finished but no PR URL found on result.git or assistant text"
        store.update_run(run_id, status="failed", last_error=msg)
        raise RuntimeError(msg)

    store.update_run(
        run_id,
        status="implement_done",
        implement_agent_id=agent_id,
        pr_url=pr_url,
        last_error="",
    )

    try:
        jira = JiraClient(settings)
        link_status = await jira.append_pr_to_description(run.jira_key, pr_url)
        logger.info(
            "jira pr link %s run_id=%s jira=%s pr_url=%s",
            link_status,
            run_id,
            run.jira_key,
            pr_url,
        )
    except Exception:
        # PR exists; do not fail the stage if Jira write flakes.
        logger.exception(
            "failed to append pr_url to Jira description run_id=%s jira=%s",
            run_id,
            run.jira_key,
        )

    try:
        gh_status = await GitHubClient(settings).mark_pr_ready_for_review(pr_url)
        logger.info(
            "github ready-for-review %s run_id=%s pr_url=%s",
            gh_status,
            run_id,
            pr_url,
        )
    except Exception:
        logger.exception(
            "failed to mark PR ready for review run_id=%s pr_url=%s",
            run_id,
            pr_url,
        )

    logger.info("implement stage complete run_id=%s pr_url=%s", run_id, pr_url)
    return pr_url
