# QA Bugbot

Chained **Cursor SDK cloud agents** that QA a pull request: plan happy path / edge cases / state transitions, test, fix on the PR branch, summarize.

## Three ways to run

### 1. GitHub Actions (recommended — automatic on every PR)

Workflow: [`.github/workflows/qa-bugbot.yml`](../../.github/workflows/qa-bugbot.yml)

Runs `npm start` on `pull_request` (`opened`, `synchronize`, `reopened`). No `TARGET_PR_URL`, ngrok, or always-on server.

**One-time setup:**

1. Repo → **Settings → Secrets and variables → Actions**
2. Add secret `CURSOR_API_KEY` (from Cursor → Settings → Integrations)
3. Ensure the repo is connected for **cloud agents** in Cursor (same account as the API key)

Push to a PR branch (or **Actions → QA Bugbot → Run workflow** with a PR number). The workflow posts the QA summary as a PR comment and uploads `runs/session-*.json` as an artifact.

Skips **draft** PRs and **fork** PRs (secrets are not exposed to external forks).

### 2. GitHub webhook (self-hosted listener)

No `TARGET_PR_URL` needed. GitHub POSTs to your server on PR events.

**Quick setup:**

```bash
cd .agents/qa-bugbot
npm install
cp .env.example .env   # CURSOR_API_KEY, REPO_URL
npm run setup-webhook    # prints step-by-step; generates secret if missing
```

Then follow the printed steps: `npm run webhook`, expose `:8788` (ngrok), add the GitHub webhook.

Optional — create the webhook via `gh` once you have a tunnel URL:

```bash
PUBLIC_BASE_URL=https://<your-ngrok-host> npm run create-github-webhook
```

### 2b. GitHub webhook (details)

When someone pushes commits to a PR (or opens/reopens it), GitHub notifies your server and the full QA chain runs automatically.

```bash
cd .agents/qa-bugbot
npm install
cp .env.example .env
# CURSOR_API_KEY, REPO_URL, GITHUB_WEBHOOK_SECRET
npm run webhook
```

Expose the server (ngrok, Cloudflare Tunnel, etc.) and add a **GitHub webhook**:

| Setting | Value |
|---------|--------|
| Payload URL | `https://<your-host>/webhooks/github` |
| Content type | `application/json` |
| Secret | Same as `GITHUB_WEBHOOK_SECRET` in `.env` |
| Events | **Pull requests** |

Triggered actions (configurable via `WEBHOOK_PR_ACTIONS`):

- `synchronize` — new commits pushed to the PR branch
- `opened` — PR created
- `reopened` — PR reopened

Only webhooks for `REPO_URL` (`owner/repo`) are processed. Draft PRs are skipped by default (`WEBHOOK_IGNORE_DRAFT=1`).

Local test without GitHub:

```bash
npm run webhook   # terminal 1
npm run simulate  # terminal 2 — uses SIMULATE_PR_NUMBER or SIMULATE_PR_URL
```

### 3. CLI (single PR, manual)

```bash
TARGET_PR_URL=https://github.com/org/repo/pull/99 npm start
```

Or set `TARGET_PR_NUMBER=99` with `REPO_URL` in `.env`.

## Chain

```
PR → 1. QA Planner → 2. QA Tester ⇄ 3. QA Fixer (≤ MAX_QA_ITERATIONS) → 4. Summary
```

All agents run on the **PR branch** (`prUrl` in cloud config). Fixes are pushed to that PR; no new PR is opened.

## Outputs

On the PR branch: `docs/qa-bugbot/<slug>/qa_plan.md`, `iteration-N/qa_results.md`, `summary.md`

Local logs:

- CLI / webhook runs: `runs/session-<timestamp>.json`
- Webhook queue: `runs/webhook-<delivery-id>.json`

## Exit codes (CLI only)

| Code | Meaning |
|------|---------|
| `0` | Finished; all scenarios passed |
| `1` | Startup error |
| `2` | Failures or NEEDS HUMAN |

The webhook server stays up; failures are recorded in the webhook JSON file.

## Requirements

- Node 18+
- `CURSOR_API_KEY`
- `REPO_URL` connected in Cursor for cloud agents
- **Actions:** `CURSOR_API_KEY` repo secret (see workflow above)
- **Webhook:** `GITHUB_WEBHOOK_SECRET` and a reachable public URL
