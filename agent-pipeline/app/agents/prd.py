from __future__ import annotations

import logging

from cursor_sdk import AsyncClient, CursorAgentError

from app.agents.common import (
    format_startup_error,
    jira_env,
    raise_if_failed,
    run_cloud_agent,
)
from app.config import Settings, load_prompt
from app.integrations.jira_client import JiraClient
from app.store import Store

logger = logging.getLogger(__name__)


async def run_prd_stage(
    client: AsyncClient,
    settings: Settings,
    store: Store,
    run_id: str,
) -> None:
    run = store.get_run(run_id)
    if run is None:
        raise KeyError(run_id)

    store.update_run(run_id, status="prd_running", last_error="")
    prompt = load_prompt("prd.md").format(jira_key=run.jira_key)
    attempt = run.attempt + 1
    store.update_run(run_id, attempt=attempt)

    async def _persist_agent(aid: str) -> None:
        store.update_run(run_id, prd_agent_id=aid)

    try:
        agent_id, result = await run_cloud_agent(
            client,
            settings,
            prompt=prompt,
            metadata={
                "stage": "prd",
                "jira_key": run.jira_key,
                "pipeline_run_id": run_id,
            },
            idempotency_key=f"pipeline:{run_id}:prd:{attempt}",
            name=f"prd-{run.jira_key}-{attempt}-{run_id[:8]}",
            env_vars=jira_env(settings),
            on_agent_created=_persist_agent,
        )
        raise_if_failed(result, label="prd")
    except (CursorAgentError, RuntimeError, Exception) as err:
        msg = format_startup_error(err)
        logger.exception("prd cloud agent failed run_id=%s", run_id)
        store.update_run(run_id, status="failed", last_error=msg)
        raise

    jira = JiraClient(settings)
    if not await jira.description_has_prd(run.jira_key):
        msg = f"Jira {run.jira_key} description missing PRD section after agent run"
        store.update_run(run_id, status="failed", last_error=msg)
        raise RuntimeError(msg)

    prd_text = await jira.get_description_text(run.jira_key)
    store.update_run(
        run_id,
        status="prd_done",
        prd_agent_id=agent_id,
        prd_text=prd_text,
        last_error="",
    )
    logger.info("prd stage complete run_id=%s jira=%s", run_id, run.jira_key)
