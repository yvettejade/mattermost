from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING

from app.agents.implement import run_implement_stage
from app.agents.prd import run_prd_stage
from app.agents.qa import run_qa_stage
from app.config import Settings
from app.store import Store

if TYPE_CHECKING:
    from cursor_sdk import AsyncClient

logger = logging.getLogger(__name__)

_run_locks: dict[str, asyncio.Lock] = {}

# Statuses that mean a Jira webhook should not start a brand-new pipeline.
_ACTIVE_OR_DONE = frozenset(
    {
        "prd_running",
        "prd_done",
        "implement_running",
        "implement_done",
        "qa_running",
        "qa_done",
    }
)


def _lock_for(run_id: str) -> asyncio.Lock:
    if run_id not in _run_locks:
        _run_locks[run_id] = asyncio.Lock()
    return _run_locks[run_id]


async def start_from_jira(
    client: AsyncClient,
    settings: Settings,
    store: Store,
    jira_key: str,
) -> str:
    existing = store.get_run_by_jira(jira_key)
    if existing is not None and existing.status in _ACTIVE_OR_DONE:
        logger.info(
            "skip duplicate jira=%s existing_status=%s run_id=%s",
            jira_key,
            existing.status,
            existing.id,
        )
        return existing.id

    run = store.create_run(jira_key, status="prd_running")
    asyncio.create_task(
        _pipeline_prd_to_qa(client, settings, store, run.id),
        name=f"pipeline-{run.id}",
    )
    return run.id


async def start_qa_for_pr(
    client: AsyncClient,
    settings: Settings,
    store: Store,
    pr_url: str,
    *,
    retest: bool = True,
) -> str | None:
    """Start (or re-start) QA for a known PR. Returns run_id or None if unknown."""
    run = store.get_run_by_pr_url(pr_url)
    if run is None:
        logger.warning("no pipeline run for pr_url=%s", pr_url)
        return None
    if run.status == "qa_running":
        logger.info("qa already running run_id=%s pr_url=%s", run.id, pr_url)
        return run.id

    asyncio.create_task(
        _run_qa_locked(client, settings, store, run.id, retest=retest),
        name=f"qa-{run.id}",
    )
    return run.id


async def _pipeline_prd_to_qa(
    client: AsyncClient,
    settings: Settings,
    store: Store,
    run_id: str,
) -> None:
    async with _lock_for(run_id):
        try:
            await run_prd_stage(client, settings, store, run_id)
            await run_implement_stage(client, settings, store, run_id)
            await run_qa_stage(client, settings, store, run_id, retest=False)
        except Exception:
            logger.exception("pipeline failed run_id=%s", run_id)
            run = store.get_run(run_id)
            if run is not None and run.status != "failed":
                store.update_run(run_id, status="failed", last_error="pipeline failed")


async def _run_qa_locked(
    client: AsyncClient,
    settings: Settings,
    store: Store,
    run_id: str,
    *,
    retest: bool,
) -> None:
    async with _lock_for(run_id):
        try:
            await run_qa_stage(client, settings, store, run_id, retest=retest)
        except Exception:
            logger.exception("qa failed run_id=%s", run_id)
            run = store.get_run(run_id)
            if run is not None and run.status != "failed":
                store.update_run(run_id, status="failed", last_error="qa failed")
