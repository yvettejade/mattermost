from __future__ import annotations

import asyncio
import logging
import sqlite3
from contextlib import asynccontextmanager
from dataclasses import asdict
from datetime import datetime, timezone
from typing import Any, AsyncIterator

from cursor_sdk import AsyncClient
from fastapi import FastAPI, HTTPException

from app.agents.common import cloud_agent_url
from app.config import Settings, get_settings
from app.integrations.github_client import GitHubClient
from app.integrations.jira_client import JiraClient
from app.orchestrator import start_qa_for_pr
from app.poller import jira_poll_loop, poll_jira_once
from app.store import Run, Store
from app.webhooks import github as github_webhooks
from app.webhooks import jira as jira_webhooks

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger(__name__)


def _reset_stale_running_runs(store: Store) -> int:
    """Mark in-flight runs as failed after a process restart so the poller can retry."""
    conn = sqlite3.connect(store.path)
    try:
        cur = conn.execute(
            """
            UPDATE runs
            SET status = 'failed',
                last_error = 'stale: server restarted while run was in progress',
                updated_at = ?
            WHERE status LIKE '%\\_running' ESCAPE '\\'
            """,
            (datetime.now(timezone.utc).isoformat(),),
        )
        conn.commit()
        return cur.rowcount
    finally:
        conn.close()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()
    store = Store(settings.database_path)
    reset = _reset_stale_running_runs(store)
    if reset:
        logger.warning("reset %d stale running run(s) after restart", reset)

    async with await AsyncClient.launch_bridge(workspace=".") as client:
        app.state.settings = settings
        app.state.store = store
        app.state.client = client

        poll_task: asyncio.Task[None] | None = None
        if settings.jira_poll_enabled:
            if not settings.jira_poll_jql.strip():
                logger.warning(
                    "JIRA_POLL_ENABLED is true but JIRA_POLL_JQL is empty; poller not started"
                )
            else:
                poll_task = asyncio.create_task(
                    jira_poll_loop(client, settings, store),
                    name="jira-poller",
                )
                logger.info(
                    "jira poller enabled every %ss",
                    settings.jira_poll_interval_seconds,
                )

        logger.info(
            "agent-pipeline ready db=%s (async cloud SDK)",
            settings.database_path,
        )
        try:
            yield
        finally:
            if poll_task is not None:
                poll_task.cancel()
                try:
                    await poll_task
                except asyncio.CancelledError:
                    pass
            get_settings.cache_clear()


app = FastAPI(title="Cursor SDK Agent Pipeline", lifespan=lifespan)
app.include_router(jira_webhooks.router)
app.include_router(github_webhooks.router)


@app.get("/health")
async def health() -> dict[str, Any]:
    settings: Settings = app.state.settings
    return {
        "status": "ok",
        "jira_poll_enabled": settings.jira_poll_enabled,
        "jira_poll_interval_seconds": settings.jira_poll_interval_seconds,
    }


@app.post("/poll/jira")
async def poll_jira_now() -> dict[str, Any]:
    """Run one Jira poll immediately (useful while tuning JQL)."""
    try:
        started = await poll_jira_once(
            app.state.client,
            app.state.settings,
            app.state.store,
        )
    except Exception as err:
        logger.exception("manual jira poll failed")
        raise HTTPException(status_code=500, detail=str(err)) from err
    return {"started": started, "count": len(started)}


def _run_payload(run: Run) -> dict[str, Any]:
    payload = asdict(run)
    payload["prd_agent_url"] = cloud_agent_url(run.prd_agent_id)
    payload["implement_agent_url"] = cloud_agent_url(run.implement_agent_id)
    payload["qa_agent_url"] = cloud_agent_url(run.qa_agent_id)
    return payload


@app.get("/runs/{jira_key}")
async def get_run(jira_key: str) -> dict[str, Any]:
    run = app.state.store.get_run_by_jira(jira_key)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    return _run_payload(run)


@app.post("/runs/{jira_key}/link-pr")
async def link_pr_to_jira(jira_key: str) -> dict[str, Any]:
    """Backfill: append stored pr_url onto the Jira description."""
    run = app.state.store.get_run_by_jira(jira_key)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    if not run.pr_url:
        raise HTTPException(status_code=400, detail="run has no pr_url yet")
    try:
        status = await JiraClient(app.state.settings).append_pr_to_description(
            jira_key,
            run.pr_url,
        )
    except Exception as err:
        logger.exception("link-pr failed jira=%s", jira_key)
        raise HTTPException(status_code=500, detail=str(err)) from err
    return {"ok": True, "jira_key": jira_key, "pr_url": run.pr_url, "status": status}


@app.post("/runs/{jira_key}/ready-for-review")
async def mark_pr_ready(jira_key: str) -> dict[str, Any]:
    """Backfill: mark the stored PR ready for review (undraft)."""
    run = app.state.store.get_run_by_jira(jira_key)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    if not run.pr_url:
        raise HTTPException(status_code=400, detail="run has no pr_url yet")
    try:
        status = await GitHubClient(app.state.settings).mark_pr_ready_for_review(run.pr_url)
    except Exception as err:
        logger.exception("ready-for-review failed jira=%s", jira_key)
        raise HTTPException(status_code=500, detail=str(err)) from err
    return {"ok": True, "jira_key": jira_key, "pr_url": run.pr_url, "status": status}


@app.post("/runs/{jira_key}/qa")
async def trigger_qa(jira_key: str) -> dict[str, Any]:
    """Manually start (or re-test) the QA cloud agent for a run with a pr_url."""
    run = app.state.store.get_run_by_jira(jira_key)
    if run is None:
        raise HTTPException(status_code=404, detail="run not found")
    if not run.pr_url:
        raise HTTPException(status_code=400, detail="run has no pr_url yet")
    retest = run.status not in {"implement_done", "prd_done"}
    run_id = await start_qa_for_pr(
        app.state.client,
        app.state.settings,
        app.state.store,
        run.pr_url,
        retest=retest,
    )
    # Re-read after enqueue so qa_agent_id may already be set.
    latest = app.state.store.get_run_by_jira(jira_key)
    return {
        "ok": True,
        "jira_key": jira_key,
        "run_id": run_id,
        "pr_url": run.pr_url,
        "retest": retest,
        "qa_agent_id": latest.qa_agent_id if latest else "",
        "qa_agent_url": cloud_agent_url(latest.qa_agent_id if latest else ""),
    }

