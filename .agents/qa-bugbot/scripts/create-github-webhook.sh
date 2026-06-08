#!/usr/bin/env bash
# Create the GitHub webhook via gh CLI (after you have a public payload URL).
#
# Usage:
#   PUBLIC_BASE_URL=https://abc123.ngrok-free.app ./scripts/create-github-webhook.sh
#
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." &>/dev/null && pwd)"
ENV_FILE="$ROOT/.env"

if [[ ! -f "$ENV_FILE" ]]; then
    echo "Missing $ENV_FILE" >&2
    exit 1
fi

# shellcheck source=load-env.sh
source "$ROOT/scripts/load-env.sh"
load_env_file "$ENV_FILE"

if [[ -z "${PUBLIC_BASE_URL:-}" ]]; then
    echo "Set PUBLIC_BASE_URL to your tunnel root, e.g. https://abc123.ngrok-free.app" >&2
    exit 1
fi

if [[ -z "${GITHUB_WEBHOOK_SECRET:-}" ]]; then
    echo "GITHUB_WEBHOOK_SECRET is empty in .env — run npm run setup-webhook first." >&2
    exit 1
fi

repo_full="${REPO_URL#https://github.com/}"
repo_full="${repo_full%.git}"
path="${WEBHOOK_PATH:-/webhooks/github}"
payload_url="${PUBLIC_BASE_URL%/}${path}"

echo "Creating webhook on $repo_full"
echo "  URL: $payload_url"

gh api "repos/${repo_full}/hooks" \
    -X POST \
    -f name='QA Bugbot' \
    -f active=true \
    -f events[]='pull_request' \
    -f "config[url]=$payload_url" \
    -f 'config[content_type]=json' \
    -f "config[secret]=$GITHUB_WEBHOOK_SECRET" \
    --jq '.id, .config.url'

echo "Done. Push to a PR or run: npm run simulate"
