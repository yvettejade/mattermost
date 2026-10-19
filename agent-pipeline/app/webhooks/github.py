from __future__ import annotations

import hashlib
import hmac
import json
import logging
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request

from app.orchestrator import start_qa_for_pr

logger = logging.getLogger(__name__)

router = APIRouter(tags=["github"])

# New commits on an existing PR. First QA is chained after implement; this is re-test.
_PR_PUSH_ACTIONS = frozenset({"synchronize"})


def verify_github_signature(raw_body: bytes, signature_header: str | None, secret: str) -> None:
    if not secret:
        return
    if not signature_header or not signature_header.startswith("sha256="):
        raise HTTPException(status_code=401, detail="missing github signature")
    digest = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    expected = "sha256=" + digest
    if not hmac.compare_digest(expected, signature_header):
        raise HTTPException(status_code=401, detail="invalid github signature")


def should_run_qa_for_pull_request(
    payload: dict[str, Any],
    *,
    bot_logins: set[str],
) -> str | None:
    """Return pr_url if this event should trigger QA, else None."""
    action = payload.get("action")
    if action not in _PR_PUSH_ACTIONS:
        return None
    pr = payload.get("pull_request")
    if not isinstance(pr, dict):
        return None
    if pr.get("draft") is True:
        return None
    sender = payload.get("sender")
    if isinstance(sender, dict):
        login = str(sender.get("login") or "").lower()
        if login in bot_logins:
            return None
    html_url = pr.get("html_url")
    if isinstance(html_url, str) and html_url:
        return html_url.rstrip("/")
    return None


@router.post("/webhooks/github")
async def github_webhook(
    request: Request,
    x_hub_signature_256: str | None = Header(default=None, alias="X-Hub-Signature-256"),
    x_github_event: str | None = Header(default=None, alias="X-GitHub-Event"),
) -> dict[str, Any]:
    settings = request.app.state.settings
    store = request.app.state.store
    client = request.app.state.client

    raw = await request.body()
    verify_github_signature(raw, x_hub_signature_256, settings.github_webhook_secret)

    if x_github_event == "ping":
        return {"ok": True, "pong": True}

    try:
        payload = json.loads(raw.decode("utf-8") or "{}")
    except json.JSONDecodeError as err:
        raise HTTPException(status_code=400, detail="invalid json") from err
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="invalid json object")

    if x_github_event != "pull_request":
        return {"ok": True, "ignored": True, "reason": f"event={x_github_event}"}

    pr_url = should_run_qa_for_pull_request(payload, bot_logins=settings.bot_logins)
    if pr_url is None:
        return {"ok": True, "ignored": True, "reason": "no qa trigger"}

    run_id = await start_qa_for_pr(client, settings, store, pr_url, retest=True)
    if run_id is None:
        return {"ok": True, "ignored": True, "reason": "unknown pr"}
    logger.info("accepted github pr synchronize pr_url=%s run_id=%s", pr_url, run_id)
    return {"ok": True, "action": "qa", "pr_url": pr_url, "run_id": run_id, "retest": True}
