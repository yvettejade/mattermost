from __future__ import annotations

from app.config import load_prompt


def test_qa_prompt_has_user_guardrails() -> None:
    text = load_prompt("qa.md").format(
        pr_url="https://github.com/org/repo/pull/1",
        jira_key="YJIRA-32",
        retest="true",
    )
    assert "start-dev.sh" in text
    assert "PASS WITH CONCERNS" in text
    assert "Never merge or approve" in text
    assert "GitHub PR comment" in text
    assert "https://github.com/org/repo/pull/1" in text
    assert "Slack" not in text or "Do not post to Slack" in text
    assert "recording_demo" not in text
    assert "demo video" not in text.lower() or "Do not record a demo video" in text
