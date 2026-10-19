from __future__ import annotations

from types import SimpleNamespace

from app.agents.common import cloud_agent_url, extract_pr_url_from_result


def test_cloud_agent_url() -> None:
    assert (
        cloud_agent_url("bc-81025bd0-f62c-4585-8cbc-45a58b1e48ef")
        == "https://cursor.com/agents/bc-81025bd0-f62c-4585-8cbc-45a58b1e48ef"
    )
    assert cloud_agent_url("agent-local") == ""
    assert cloud_agent_url("") == ""
    assert cloud_agent_url(None) == ""


def test_extract_pr_url_from_git_branches() -> None:
    result = SimpleNamespace(
        git=SimpleNamespace(
            branches=[
                SimpleNamespace(pr_url="https://github.com/org/repo/pull/12"),
            ]
        ),
        result="",
    )
    assert extract_pr_url_from_result(result) == "https://github.com/org/repo/pull/12"


def test_extract_pr_url_from_text_line() -> None:
    result = SimpleNamespace(git=None, result="")
    text = "done\nPR_URL: https://github.com/a/b/pull/3\n"
    assert extract_pr_url_from_result(result, text) == "https://github.com/a/b/pull/3"


def test_extract_pr_url_missing() -> None:
    result = SimpleNamespace(git=None, result="no pr here")
    assert extract_pr_url_from_result(result) == ""
