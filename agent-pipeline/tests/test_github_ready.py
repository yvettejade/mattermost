from __future__ import annotations

from app.integrations.github_client import parse_pr_url


def test_parse_pr_url() -> None:
    assert parse_pr_url("https://github.com/yvettejade/mattermost/pull/246") == (
        "yvettejade",
        "mattermost",
        246,
    )
    assert parse_pr_url("https://www.github.com/org/repo/pull/1/") == ("org", "repo", 1)


def test_parse_pr_url_rejects_junk() -> None:
    assert parse_pr_url("https://gitlab.com/org/repo/pull/1") is None
    assert parse_pr_url("https://github.com/org/repo/issues/1") is None
    assert parse_pr_url("") is None
