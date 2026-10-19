from __future__ import annotations

from app.integrations.jira_client import (
    merge_pr_into_description,
    pr_url_already_linked,
)


def test_pr_url_already_linked() -> None:
    url = "https://github.com/org/repo/pull/246"
    assert pr_url_already_linked(f"see {url}", url)
    assert not pr_url_already_linked("no pr yet", url)


def test_merge_pr_into_existing_adf() -> None:
    url = "https://github.com/org/repo/pull/246"
    existing = {
        "type": "doc",
        "version": 1,
        "content": [
            {
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": "PRD"}],
            }
        ],
    }
    merged = merge_pr_into_description(existing, url)
    assert merged["type"] == "doc"
    assert len(merged["content"]) == 3
    assert merged["content"][1]["type"] == "heading"
    assert merged["content"][1]["content"][0]["text"] == "Pull request"
    link = merged["content"][2]["content"][0]
    assert link["text"] == url
    assert link["marks"][0]["attrs"]["href"] == url


def test_merge_pr_into_empty_description() -> None:
    url = "https://github.com/org/repo/pull/1"
    merged = merge_pr_into_description(None, url)
    assert merged["content"][0]["content"][0]["text"] == "Pull request"
    assert merged["content"][1]["content"][0]["text"] == url
