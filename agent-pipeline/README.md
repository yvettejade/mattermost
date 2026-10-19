# agent-pipeline

FastAPI orchestrator that chains Cursor **cloud** agents via the Python SDK
(`cursor-sdk`) when a Jira issue is created:

1. **PRD** — draft a PRD (same shape as the BDK `jira-prd` bot)
   and append it under `## PRD` on the issue description.
2. **Implement** — implement from the PRD and open a GitHub PR
   (`auto_create_pr=True`), link the PR on Jira, mark ready for review.
3. **QA** — verify the PR in a cloud VM (`start-dev.sh`, tests) and post a
   GitHub PR comment with findings. Re-runs on GitHub `pull_request`
   `synchronize` (new pushes to the PR).

## Setup

```bash
cd agent-pipeline
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp env.example .env   # fill CURSOR_API_KEY, Jira, REPO_URL, PIPELINE_WEBHOOK_SECRET
```

## Run

```bash
uvicorn app.main:app --reload --port 8080
```

- `GET /health`
- `GET /runs/{jira_key}` — includes `prd_agent_url`, `implement_agent_url`,
  `qa_agent_url` (`https://cursor.com/agents/bc-…`) when set
- `POST /runs/{jira_key}/link-pr` — append stored `pr_url` onto the Jira description
- `POST /runs/{jira_key}/qa` — manually start / re-test QA
- `POST /webhooks/jira` — optional `X-Pipeline-Secret` if `PIPELINE_WEBHOOK_SECRET` is set
- `POST /webhooks/github` — `pull_request` synchronize → QA retest
- `POST /poll/jira` — one-shot JQL poll (when `JIRA_POLL_JQL` is set)

After implement opens a PR, the orchestrator:

1. Appends a **Pull request** section with the PR URL to the Jira description
   (idempotent if already present).
2. Marks the GitHub PR ready for review if it was opened as a draft
   (requires `GITHUB_TOKEN` with `pull_requests:write`).

Backfill helpers: `POST /runs/{jira_key}/link-pr`,
`POST /runs/{jira_key}/ready-for-review`, `POST /runs/{jira_key}/qa`.

### GitHub webhook (QA on push)

1. Expose the pipeline publicly (e.g. `cloudflared tunnel` / ngrok →
   `http://127.0.0.1:8080`).
2. In the GitHub repo: **Settings → Webhooks → Add webhook**.
3. **Payload URL:** `https://<your-tunnel>/webhooks/github`
4. **Content type:** `application/json`
5. **Secret:** same value as `GITHUB_WEBHOOK_SECRET` in `.env` (optional locally;
   recommended when public).
6. **Which events:** choose **Let me select individual events**, enable
   **Pull requests** (synchronize → QA retest).
7. Save. GitHub sends a `ping`; `/webhooks/github` responds `{"pong": true}`.

### Jira trigger

Point a Jira automation / webhook for **issue created** at your public tunnel:

`POST https://<tunnel>/webhooks/jira`

Body must include an issue key (`issue.key`, `issueKey`, or bare `key`).

If `PIPELINE_WEBHOOK_SECRET` is empty (default for local), no auth header is
required. Set the secret before exposing the endpoint publicly.

Alternative: enable `JIRA_POLL_ENABLED=true` + `JIRA_POLL_JQL` (e.g.
`project = ENG AND created >= -1h ORDER BY created ASC`).

### Smoke without waiting on a real create

```bash
curl -s -X POST http://127.0.0.1:8080/webhooks/jira \
  -H "content-type: application/json" \
  -d '{"issue":{"key":"ENG-142"}}'
```

Then watch logs and `GET /runs/ENG-142`. Confirm the Jira description gained
`## PRD`, then that a PR opened on `REPO_URL`.

## Tests

```bash
pytest
```

## Notes

- Cloud agents need a Cursor API key with repo access for `REPO_URL`.
- Filter Cursor Web agents with **Source → SDK** to see SDK-launched runs.
- Prefer `env_vars` for Jira credentials (injected into the cloud VM). Do not
  commit `.env`.
- Previous revision used a REST bootstrap workaround when SDK streams 504’d;
  this cut uses `AsyncClient` + `create_agent` + `run.wait()` per current SDK
  docs. If create hangs again, we can reintroduce the bootstrap path.
