from __future__ import annotations

import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass
class Run:
    id: str
    jira_key: str
    status: str
    prd_agent_id: str = ""
    implement_agent_id: str = ""
    qa_agent_id: str = ""
    pr_url: str = ""
    prd_text: str = ""
    last_error: str = ""
    attempt: int = 0
    created_at: str = ""
    updated_at: str = ""
    metadata_json: str = "{}"


class Store:
    def __init__(self, path: str) -> None:
        self.path = path
        Path(path).parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.executescript(
                """
                CREATE TABLE IF NOT EXISTS runs (
                    id TEXT PRIMARY KEY,
                    jira_key TEXT NOT NULL,
                    status TEXT NOT NULL,
                    prd_agent_id TEXT DEFAULT '',
                    implement_agent_id TEXT DEFAULT '',
                    qa_agent_id TEXT DEFAULT '',
                    pr_url TEXT DEFAULT '',
                    prd_text TEXT DEFAULT '',
                    last_error TEXT DEFAULT '',
                    attempt INTEGER DEFAULT 0,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    metadata_json TEXT DEFAULT '{}'
                );
                CREATE INDEX IF NOT EXISTS idx_runs_jira ON runs(jira_key);
                CREATE INDEX IF NOT EXISTS idx_runs_pr ON runs(pr_url);
                """
            )
            cols = {row[1] for row in conn.execute("PRAGMA table_info(runs)")}
            if "qa_agent_id" not in cols:
                conn.execute("ALTER TABLE runs ADD COLUMN qa_agent_id TEXT DEFAULT ''")

    def create_run(self, jira_key: str, status: str = "prd_running") -> Run:
        run = Run(
            id=str(uuid.uuid4()),
            jira_key=jira_key,
            status=status,
            created_at=_now(),
            updated_at=_now(),
        )
        with self._connect() as conn:
            conn.execute(
                """
                INSERT INTO runs (
                    id, jira_key, status, prd_agent_id, implement_agent_id, qa_agent_id,
                    pr_url, prd_text, last_error, attempt, created_at, updated_at, metadata_json
                ) VALUES (?, ?, ?, '', '', '', '', '', '', 0, ?, ?, '{}')
                """,
                (run.id, run.jira_key, run.status, run.created_at, run.updated_at),
            )
        return run

    def get_run(self, run_id: str) -> Run | None:
        with self._connect() as conn:
            row = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        return self._row_to_run(row) if row else None

    def get_run_by_jira(self, jira_key: str) -> Run | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM runs WHERE jira_key = ? ORDER BY created_at DESC LIMIT 1",
                (jira_key,),
            ).fetchone()
        return self._row_to_run(row) if row else None

    def get_run_by_pr_url(self, pr_url: str) -> Run | None:
        with self._connect() as conn:
            row = conn.execute(
                "SELECT * FROM runs WHERE pr_url = ? ORDER BY created_at DESC LIMIT 1",
                (pr_url,),
            ).fetchone()
        return self._row_to_run(row) if row else None

    def update_run(self, run_id: str, **fields: Any) -> None:
        allowed = {
            "status",
            "prd_agent_id",
            "implement_agent_id",
            "qa_agent_id",
            "pr_url",
            "prd_text",
            "last_error",
            "attempt",
            "metadata_json",
        }
        unknown = set(fields) - allowed
        if unknown:
            raise ValueError(f"unsupported field: {sorted(unknown)}")
        if not fields:
            return
        fields["updated_at"] = _now()
        assignments = ", ".join(f"{k} = ?" for k in fields)
        values = list(fields.values()) + [run_id]
        with self._connect() as conn:
            conn.execute(f"UPDATE runs SET {assignments} WHERE id = ?", values)

    @staticmethod
    def _row_to_run(row: sqlite3.Row) -> Run:
        keys = row.keys()
        return Run(
            id=row["id"],
            jira_key=row["jira_key"],
            status=row["status"],
            prd_agent_id=row["prd_agent_id"] or "",
            implement_agent_id=row["implement_agent_id"] or "",
            qa_agent_id=(row["qa_agent_id"] if "qa_agent_id" in keys else "") or "",
            pr_url=row["pr_url"] or "",
            prd_text=row["prd_text"] or "",
            last_error=row["last_error"] or "",
            attempt=int(row["attempt"] or 0),
            created_at=row["created_at"] or "",
            updated_at=row["updated_at"] or "",
            metadata_json=row["metadata_json"] or "{}",
        )
