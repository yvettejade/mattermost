from __future__ import annotations

from app.webhooks.github import should_run_qa_for_pull_request


def test_synchronize_triggers_qa() -> None:
    pr_url = should_run_qa_for_pull_request(
        {
            "action": "synchronize",
            "sender": {"login": "alice"},
            "pull_request": {
                "draft": False,
                "html_url": "https://github.com/org/repo/pull/9",
            },
        },
        bot_logins={"cursor[bot]"},
    )
    assert pr_url == "https://github.com/org/repo/pull/9"


def test_opened_does_not_double_trigger() -> None:
    # First QA is chained after implement; opened would race.
    result = should_run_qa_for_pull_request(
        {
            "action": "opened",
            "sender": {"login": "alice"},
            "pull_request": {
                "draft": False,
                "html_url": "https://github.com/org/repo/pull/9",
            },
        },
        bot_logins=set(),
    )
    assert result is None


def test_bot_and_draft_skipped() -> None:
    bot = should_run_qa_for_pull_request(
        {
            "action": "synchronize",
            "sender": {"login": "cursor[bot]"},
            "pull_request": {
                "draft": False,
                "html_url": "https://github.com/org/repo/pull/9",
            },
        },
        bot_logins={"cursor[bot]"},
    )
    assert bot is None

    draft = should_run_qa_for_pull_request(
        {
            "action": "synchronize",
            "sender": {"login": "alice"},
            "pull_request": {
                "draft": True,
                "html_url": "https://github.com/org/repo/pull/9",
            },
        },
        bot_logins=set(),
    )
    assert draft is None
