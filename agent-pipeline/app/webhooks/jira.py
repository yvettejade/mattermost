from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request

from app.integrations.jira_client import extract_issue_key
from app.orchestrator import start_from_jira

logger = logging.getLogger(__name__)

router = APIRouter(tags=["jira"])


def _verify_secret(provided: str | None, expected: str) -> None:
    """No-op when expected is empty (local/dev). Enforce only if configured."""
    if not expected:
        return
    if provided != expected:
        raise HTTPException(status_code=401, detail="invalid webhook secret")


@router.post("/webhooks/jira")
async def jira_webhook(
    request: Request,
    x_pipeline_secret: str | None = Header(default=None, alias="X-Pipeline-Secret"),
) -> dict[str, Any]:
    settings = request.app.state.settings
    store = request.app.state.store
    client = request.app.state.client
    _verify_secret(x_pipeline_secret, settings.pipeline_webhook_secret)

    payload = await request.json()
    event = payload.get("webhookEvent")
    # Bare smoke payloads ({"issue":{"key":"..."}}) omit webhookEvent.
    if isinstance(event, str) and event != "jira:issue_created":
        return {"ok": True, "ignored": True, "reason": f"event={event}"}

    key = extract_issue_key(payload)
    if key is None:
        raise HTTPException(status_code=400, detail="missing issue key")

    run_id = await start_from_jira(client, settings, store, key)
    logger.info("accepted jira webhook issue=%s run_id=%s", key, run_id)
    return {"ok": True, "jira_key": key, "run_id": run_id}
