from __future__ import annotations

from app.integrations.jira_client import (
    _adf_to_text,
    extract_issue_key,
    extract_keys_from_search_response,
    has_prd_section,
)


def test_extract_from_issue_object() -> None:
    assert extract_issue_key({"issue": {"key": "MM-42"}}) == "MM-42"


def test_extract_from_bare_key() -> None:
    assert extract_issue_key({"issueKey": "MM-99"}) == "MM-99"


def test_extract_missing() -> None:
    assert extract_issue_key({"hello": "world"}) is None


def test_extract_keys_from_search_jql_response() -> None:
    data = {"issues": [{"key": "YJIRA-1"}, {"key": "YJIRA-2"}]}
    assert extract_keys_from_search_response(data) == ["YJIRA-1", "YJIRA-2"]


def test_has_prd_section_markdown() -> None:
    assert has_prd_section("intro\n\n## PRD\n\n### Problem\n")
    assert has_prd_section("## PRD\n\nbody\n\n<!-- /PRD -->")


def test_has_prd_section_bare_heading_from_adf() -> None:
    # What users see after Jira stores a heading node and we flatten text.
    assert has_prd_section("PRD\n\nProblem\n\nMattermost channels…\n\n<!-- /PRD -->")
    assert has_prd_section("# PRD\n\n### Problem")


def test_has_prd_section_absent() -> None:
    assert not has_prd_section("just a ticket about PRDs in general")
    assert not has_prd_section("")


def test_adf_heading_preserves_markdown_level() -> None:
    adf = {
        "type": "doc",
        "content": [
            {
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": "PRD"}],
            },
            {
                "type": "heading",
                "attrs": {"level": 3},
                "content": [{"type": "text", "text": "Problem"}],
            },
        ],
    }
    text = _adf_to_text(adf)
    assert "## PRD" in text
    assert "### Problem" in text
    assert has_prd_section(text)
