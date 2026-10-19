from __future__ import annotations

import asyncio
import logging

from cursor_sdk import AsyncClient

from app.config import Settings
from app.integrations.jira_client import JiraClient
from app.orchestrator import start_from_jira
from app.store import Store

logger = logging.getLogger(__name__)


async def poll_jira_once(
    client: AsyncClient,
    settings: Settings,
    store: Store,
) -> list[str]:
    """Search Jira and start the pipeline for any new issue keys. Returns started keys."""
    jql = settings.jira_poll_jql.strip()
    if not jql:
        logger.warning("jira poll skipped: JIRA_POLL_JQL is empty")
        return []

    jira = JiraClient(settings)
    keys = await jira.search_issue_keys(jql)
    started: list[str] = []
    for key in keys:
        existing = store.get_run_by_jira(key)
        if existing is not None and existing.status not in {"failed"}:
            continue
        run_id = await start_from_jira(client, settings, store, key)
        started.append(key)
        logger.info("poll started pipeline jira=%s run_id=%s", key, run_id)
    return started


async def jira_poll_loop(
    client: AsyncClient,
    settings: Settings,
    store: Store,
) -> None:
    interval = max(5, settings.jira_poll_interval_seconds)
    logger.info("jira poller started interval=%ss jql=%r", interval, settings.jira_poll_jql)
    while True:
        try:
            started = await poll_jira_once(client, settings, store)
            if started:
                logger.info("jira poll started %d issue(s): %s", len(started), ", ".join(started))
            else:
                logger.debug("jira poll found no new issues")
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("jira poll iteration failed")
        await asyncio.sleep(interval)
