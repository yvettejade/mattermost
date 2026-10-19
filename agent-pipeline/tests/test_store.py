from __future__ import annotations

from pathlib import Path

from app.store import Store


def test_create_and_get_run(tmp_path: Path) -> None:
    store = Store(str(tmp_path / "pipeline.db"))
    run = store.create_run("MM-1", status="prd_running")
    loaded = store.get_run(run.id)
    assert loaded is not None
    assert loaded.jira_key == "MM-1"
    assert loaded.status == "prd_running"

    by_jira = store.get_run_by_jira("MM-1")
    assert by_jira is not None
    assert by_jira.id == run.id


def test_update_run_fields(tmp_path: Path) -> None:
    store = Store(str(tmp_path / "pipeline.db"))
    run = store.create_run("MM-2")
    store.update_run(
        run.id,
        status="qa_done",
        pr_url="https://github.com/org/repo/pull/1",
        prd_text="## PRD\n\nok",
        implement_agent_id="bc-abc",
        qa_agent_id="bc-qa",
    )
    loaded = store.get_run(run.id)
    assert loaded is not None
    assert loaded.status == "qa_done"
    assert loaded.pr_url.endswith("/pull/1")
    assert loaded.implement_agent_id == "bc-abc"
    assert loaded.qa_agent_id == "bc-qa"


def test_update_rejects_unknown_field(tmp_path: Path) -> None:
    store = Store(str(tmp_path / "pipeline.db"))
    run = store.create_run("MM-3")
    try:
        store.update_run(run.id, not_a_field="x")  # type: ignore[arg-type]
        raise AssertionError("expected ValueError")
    except ValueError as err:
        assert "unsupported field" in str(err)
