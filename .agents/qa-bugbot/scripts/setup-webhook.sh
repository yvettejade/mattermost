#!/usr/bin/env bash
# Print GitHub webhook setup steps for QA Bugbot.
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." &>/dev/null && pwd)"
ENV_FILE="$ROOT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing $ENV_FILE — copy .env.example first." >&2
    exit 1
fi

# shellcheck source=load-env.sh
source "$ROOT/scripts/load-env.sh"
load_env_file "$ENV_FILE"

if [[ -z "${GITHUB_WEBHOOK_SECRET:-}" ]]; then
    secret="$(openssl rand -hex 32)"
    if grep -q '^GITHUB_WEBHOOK_SECRET=' "$ENV_FILE"; then
        sed -i '' "s/^GITHUB_WEBHOOK_SECRET=.*/GITHUB_WEBHOOK_SECRET=$secret/" "$ENV_FILE"
    else
        printf '\nGITHUB_WEBHOOK_SECRET=%s\n' "$secret" >>"$ENV_FILE"
    fi
    GITHUB_WEBHOOK_SECRET="$secret"
    echo "Generated GITHUB_WEBHOOK_SECRET in .env"
fi

repo="${REPO_URL:-https://github.com/your-org/your-repo}"
port="${PORT:-8788}"
path="${WEBHOOK_PATH:-/webhooks/github}"
actions="${WEBHOOK_PR_ACTIONS:-synchronize,opened,reopened}"

cat <<EOF

QA Bugbot — GitHub webhook setup
================================

1) Start the listener (keep this terminal open):

   cd $ROOT
   npm run webhook

2) Expose port $port to the internet. Example with ngrok:

   brew install ngrok/ngrok/ngrok   # once
   ngrok http $port

   Copy the https URL (e.g. https://abc123.ngrok-free.app).

3) Add the webhook on GitHub:

   $repo → Settings → Webhooks → Add webhook

   Payload URL:  <ngrok-https-url>${path}
   Content type: application/json
   Secret:       (value of GITHUB_WEBHOOK_SECRET in .env)
   Events:       Pull requests

   Trigger actions (from .env): $actions
   Draft PRs are skipped unless WEBHOOK_IGNORE_DRAFT=0.

4) Test locally without GitHub:

   npm run webhook          # terminal 1
   npm run simulate         # terminal 2

5) Test on GitHub:

   Open or push to a PR on $repo — QA runs automatically.
   Logs: $ROOT/runs/webhook-<delivery-id>.json

Health check (listener must be running):

   curl http://localhost:$port/health

EOF
