from __future__ import annotations

from types import SimpleNamespace

import pytest
from cursor_sdk import CursorAgentError

from app.agents.common import wait_run_result


@pytest.mark.asyncio
async def test_wait_retries_retryable_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    calls = {"n": 0}

    class FakeRun:
        id = "run-1"

        async def wait(self):
            calls["n"] += 1
            raise CursorAgentError("Bridge request timed out", is_retryable=True)

    class FakeClient:
        async def wait_live_run(self, run_id: str):
            calls["n"] += 1
            if calls["n"] < 3:
                raise CursorAgentError("Bridge request timed out", is_retryable=True)
            return SimpleNamespace(status="finished", id=run_id)

    async def _no_sleep(_: float) -> None:
        return None

    monkeypatch.setattr("app.agents.common.asyncio.sleep", _no_sleep)
    result = await wait_run_result(FakeClient(), FakeRun(), attempts=4, base_delay_seconds=0)
    assert result.status == "finished"
    assert calls["n"] == 3


@pytest.mark.asyncio
async def test_wait_does_not_retry_non_retryable() -> None:
    class FakeRun:
        id = "run-2"

        async def wait(self):
            raise CursorAgentError("auth failed", is_retryable=False)

    with pytest.raises(CursorAgentError, match="auth failed"):
        await wait_run_result(object(), FakeRun(), attempts=3, base_delay_seconds=0)
