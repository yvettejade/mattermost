from __future__ import annotations

import re
from typing import Any

import httpx

from app.config import Settings

PRD_MARKER = "## PRD"
PRD_END_MARKER = "<!-- /PRD -->"
# Jira ADF headings often come back as bare "PRD" after text extraction.
_PRD_HEADING_RE = re.compile(r"(?im)^\s*(?:#{1,6}\s*)?PRD\s*$")
_ISSUE_KEY_RE = re.compile(r"^[A-Z][A-Z0-9]+-\d+$")


class JiraClient:
    def __init__(self, settings: Settings) -> None:
        self.base = settings.jira_base_url.rstrip("/")
        self._auth = (settings.jira_email, settings.jira_api_token)

    def _headers(self) -> dict[str, str]:
        return {"Accept": "application/json", "Content-Type": "application/json"}

    async def get_issue(self, issue_key: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{self.base}/rest/api/3/issue/{issue_key}",
                auth=self._auth,
                headers=self._headers(),
            )
            resp.raise_for_status()
            return resp.json()

    async def get_description_text(self, issue_key: str) -> str:
        issue = await self.get_issue(issue_key)
        description = (issue.get("fields") or {}).get("description")
        if isinstance(description, str):
            return description
        return _adf_to_text(description)

    async def description_has_prd(self, issue_key: str) -> bool:
        text = await self.get_description_text(issue_key)
        return has_prd_section(text)

    async def append_pr_to_description(self, issue_key: str, pr_url: str) -> str:
        """Append a Pull request section with pr_url. Returns 'added' | 'already_present'."""
        issue = await self.get_issue(issue_key)
        description = (issue.get("fields") or {}).get("description")
        text = description if isinstance(description, str) else _adf_to_text(description)
        if pr_url_already_linked(text, pr_url):
            return "already_present"

        new_description = merge_pr_into_description(description, pr_url)
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.put(
                f"{self.base}/rest/api/3/issue/{issue_key}",
                auth=self._auth,
                headers=self._headers(),
                json={"fields": {"description": new_description}},
            )
            resp.raise_for_status()
        return "added"

    async def search_issue_keys(self, jql: str, max_results: int = 50) -> list[str]:
        """Return issue keys matching JQL, oldest first when the JQL orders by created."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base}/rest/api/3/search/jql",
                auth=self._auth,
                headers=self._headers(),
                json={"jql": jql, "maxResults": max_results, "fields": ["key"]},
            )
            resp.raise_for_status()
            return extract_keys_from_search_response(resp.json())


def extract_keys_from_search_response(data: dict[str, Any]) -> list[str]:
    keys: list[str] = []
    for issue in data.get("issues") or []:
        if not isinstance(issue, dict):
            continue
        key = issue.get("key")
        if isinstance(key, str) and key:
            keys.append(key)
    return keys


def extract_issue_key(payload: dict[str, Any]) -> str | None:
    issue = payload.get("issue")
    if isinstance(issue, dict):
        key = issue.get("key")
        if isinstance(key, str) and _ISSUE_KEY_RE.match(key):
            return key
    bare = payload.get("issueKey") or payload.get("key")
    if isinstance(bare, str) and _ISSUE_KEY_RE.match(bare):
        return bare
    return None


def has_prd_section(description: str) -> bool:
    """True if description contains a PRD section (markdown or ADF-flattened)."""
    if not description:
        return False
    if PRD_END_MARKER in description:
        return True
    if PRD_MARKER in description:
        return True
    return _PRD_HEADING_RE.search(description) is not None


def pr_url_already_linked(description: str, pr_url: str) -> bool:
    if not description or not pr_url:
        return False
    return pr_url.rstrip("/") in description


def merge_pr_into_description(description: Any, pr_url: str) -> dict[str, Any]:
    """Return ADF doc with a Pull request section appended."""
    nodes = _pr_section_adf_nodes(pr_url)
    if isinstance(description, dict) and description.get("type") == "doc":
        content = list(description.get("content") or [])
        content.extend(nodes)
        return {
            "type": "doc",
            "version": int(description.get("version") or 1),
            "content": content,
        }
    # String / empty / unexpected: keep prior text as paragraphs, then PR block.
    prior = description if isinstance(description, str) else _adf_to_text(description)
    content: list[dict[str, Any]] = []
    if prior.strip():
        for line in prior.splitlines():
            content.append(
                {
                    "type": "paragraph",
                    "content": [{"type": "text", "text": line}] if line else [],
                }
            )
    content.extend(nodes)
    return {"type": "doc", "version": 1, "content": content}


def _pr_section_adf_nodes(pr_url: str) -> list[dict[str, Any]]:
    return [
        {
            "type": "heading",
            "attrs": {"level": 2},
            "content": [{"type": "text", "text": "Pull request"}],
        },
        {
            "type": "paragraph",
            "content": [
                {
                    "type": "text",
                    "text": pr_url,
                    "marks": [{"type": "link", "attrs": {"href": pr_url}}],
                }
            ],
        },
    ]


def _adf_to_text(node: Any) -> str:
    if node is None:
        return ""
    if isinstance(node, str):
        return node
    if isinstance(node, list):
        return "\n".join(part for part in (_adf_to_text(item) for item in node) if part)
    if not isinstance(node, dict):
        return ""

    node_type = node.get("type")
    if node_type == "text" and isinstance(node.get("text"), str):
        return node["text"]

    content = node.get("content")
    inner = ""
    if isinstance(content, list):
        if node_type == "paragraph":
            inner = "".join(_adf_to_text(c) for c in content)
        else:
            inner = "\n".join(part for part in (_adf_to_text(c) for c in content) if part)

    if node_type == "heading":
        level = 1
        attrs = node.get("attrs")
        if isinstance(attrs, dict) and isinstance(attrs.get("level"), int):
            level = max(1, min(6, attrs["level"]))
        prefix = "#" * level
        return f"{prefix} {inner.strip()}" if inner.strip() else ""

    return inner
