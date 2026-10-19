from __future__ import annotations

import re
from typing import Any
from urllib.parse import urlparse

import httpx

from app.config import Settings

_PR_PATH_RE = re.compile(r"^/([^/]+)/([^/]+)/pull/(\d+)/?$")


class GitHubClient:
    def __init__(self, settings: Settings) -> None:
        self._token = settings.github_token.strip()

    def enabled(self) -> bool:
        return bool(self._token)

    def _headers(self) -> dict[str, str]:
        return {
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {self._token}",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    async def mark_pr_ready_for_review(self, pr_url: str) -> str:
        """Mark a draft PR ready for review. Returns status string."""
        if not self.enabled():
            return "skipped_no_token"
        parsed = parse_pr_url(pr_url)
        if parsed is None:
            return "skipped_bad_url"
        owner, repo, number = parsed

        async with httpx.AsyncClient(timeout=30.0) as client:
            get_resp = await client.get(
                f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}",
                headers=self._headers(),
            )
            get_resp.raise_for_status()
            pr: dict[str, Any] = get_resp.json()
            if not pr.get("draft"):
                return "already_ready"

            ready_resp = await client.post(
                f"https://api.github.com/repos/{owner}/{repo}/pulls/{number}/ready_for_review",
                headers=self._headers(),
            )
            if ready_resp.status_code == 422:
                # Not a draft / already ready race.
                return "already_ready"
            ready_resp.raise_for_status()
            return "marked_ready"


def parse_pr_url(pr_url: str) -> tuple[str, str, int] | None:
    try:
        parts = urlparse(pr_url.strip())
    except Exception:
        return None
    if parts.netloc not in {"github.com", "www.github.com"}:
        return None
    match = _PR_PATH_RE.match(parts.path)
    if match is None:
        return None
    return match.group(1), match.group(2), int(match.group(3))
