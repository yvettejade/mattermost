from __future__ import annotations

from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.webhooks import jira as jira_webhooks


class _FakeStore:
    def get_run_by_jira(self, key: str) -> None:
        return None

    def create_run(self, jira_key: str, status: str = "prd_running") -> Any:
        return type("R", (), {"id": "run-1", "jira_key": jira_key, "status": status})()


def _make_client(monkeypatch: pytest.MonkeyPatch, secret: str) -> TestClient:
    app = FastAPI()
    app.include_router(jira_webhooks.router)

    class Settings:
        pipeline_webhook_secret = secret

    app.state.settings = Settings()
    app.state.store = _FakeStore()
    app.state.client = object()

    async def _start(_client: Any, _settings: Any, _store: Any, jira_key: str) -> str:
        return f"run-for-{jira_key}"

    monkeypatch.setattr(jira_webhooks, "start_from_jira", _start)
    return TestClient(app)


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    return _make_client(monkeypatch, secret="secret")


@pytest.fixture
def open_client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    return _make_client(monkeypatch, secret="")


def test_accepts_issue_created(client: TestClient) -> None:
    resp = client.post(
        "/webhooks/jira",
        headers={"X-Pipeline-Secret": "secret"},
        json={"webhookEvent": "jira:issue_created", "issue": {"key": "ENG-1"}},
    )
    assert resp.status_code == 200
    assert resp.json()["run_id"] == "run-for-ENG-1"


def test_ignores_non_created(client: TestClient) -> None:
    resp = client.post(
        "/webhooks/jira",
        headers={"X-Pipeline-Secret": "secret"},
        json={"webhookEvent": "jira:issue_updated", "issue": {"key": "ENG-1"}},
    )
    assert resp.status_code == 200
    assert resp.json()["ignored"] is True


def test_rejects_bad_secret(client: TestClient) -> None:
    resp = client.post(
        "/webhooks/jira",
        headers={"X-Pipeline-Secret": "nope"},
        json={"issue": {"key": "ENG-1"}},
    )
    assert resp.status_code == 401


def test_allows_missing_secret_when_unconfigured(open_client: TestClient) -> None:
    resp = open_client.post(
        "/webhooks/jira",
        json={"webhookEvent": "jira:issue_created", "issue": {"key": "ENG-1"}},
    )
    assert resp.status_code == 200
    assert resp.json()["run_id"] == "run-for-ENG-1"
