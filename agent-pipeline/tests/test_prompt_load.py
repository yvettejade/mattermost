from __future__ import annotations

from app.config import load_prompt


def test_load_prd_prompt_has_sections() -> None:
    text = load_prompt("prd.md")
    assert "{jira_key}" in text
    assert "## PRD" in text
    assert "Acceptance criteria" in text


def test_load_implement_prompt_formats() -> None:
    text = load_prompt("implement.md").format(
        jira_key="MM-7",
        prd_text="### Problem\nbroken",
    )
    assert "MM-7" in text
    assert "broken" in text
    assert "PR_URL:" in text
