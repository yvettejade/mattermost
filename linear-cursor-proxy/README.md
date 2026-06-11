# Jira / Linear → Cursor webhook proxy

Neither Jira nor Linear can attach a custom `Authorization` header to their outgoing
webhooks (their "Secret" field is only for HMAC signature verification). But the Cursor
automation webhook trigger requires `Authorization: Bearer <token>`. This Cloudflare
Worker bridges the gap:

1. Receives the webhook from Jira or Linear.
2. Auto-detects the source by signature header and verifies HMAC-SHA256:
   - **Jira** → `X-Hub-Signature: sha256=<hex>` (verified with `JIRA_WEBHOOK_SECRET`)
   - **Linear** → `Linear-Signature: <hex>` (verified with `LINEAR_WEBHOOK_SECRET`)
3. For Linear, rejects stale payloads (replay protection via `webhookTimestamp`).
4. Forwards the **unmodified** body to Cursor with the bearer token attached.

```
Jira/Linear  ──POST (signature header)──▶  Worker  ──POST (Authorization: Bearer …)──▶  Cursor automation
```

You can enable just one source or both — only set the secrets for the sources you use.

## Prerequisites

- A Cloudflare account (free tier is fine).
- Node.js installed (you already have it).
- Your Cursor automation webhook **URL** and **bearer token**.
- The webhook **secret** for each source you want to forward.

> Security: regenerate the Cursor webhook token if it was ever shared in plaintext.
> Secrets below are stored with `wrangler secret put`, never committed.

## 1. Install dependencies

```bash
cd linear-cursor-proxy
npm install
```

## 2. Configure the Cursor URL

Edit `wrangler.toml` and set `CURSOR_WEBHOOK_URL` to your automation's webhook URL.

## 3. Set secrets

```bash
# Cursor bearer token (paste WITHOUT the "Bearer " prefix when prompted) — required
npx wrangler secret put CURSOR_AUTH_TOKEN

# Set whichever source(s) you use:
npx wrangler secret put JIRA_WEBHOOK_SECRET
npx wrangler secret put LINEAR_WEBHOOK_SECRET
```

## 4. Deploy

```bash
npx wrangler deploy
```

Wrangler prints the public URL, e.g. `https://linear-cursor-proxy.<subdomain>.workers.dev`.
Copy it — this is the URL you give to Jira and/or Linear.

## 5. Point your source at the Worker

### Jira
In Jira: **Settings → System → WebHooks → Create / edit a webhook**.

- **URL**: the Worker URL from step 4.
- **Secret**: set a secret (or "Generate secret"). Jira shows it only once — copy it.
- Select the events / JQL you want.
- Save, then store the secret on the Worker:

```bash
npx wrangler secret put JIRA_WEBHOOK_SECRET   # paste the Jira secret
```

> Jira's secret is not retrievable after saving. If you lose it, generate a new one
> in Jira and re-run the command above.

### Linear
In Linear: **Settings → API → Webhooks → New webhook**.

- **URL**: the Worker URL from step 4.
- Select the events you want, save, then open the webhook to copy its **Signing secret**.

```bash
npx wrangler secret put LINEAR_WEBHOOK_SECRET
```

## Local testing

```bash
cp .dev.vars.example .dev.vars   # fill in real values; .dev.vars is gitignored
npx wrangler dev
```

Send a signed test request. **Jira** (`X-Hub-Signature: sha256=<hex>`):

```bash
SECRET="<your JIRA_WEBHOOK_SECRET>"
BODY='{"webhookEvent":"jira:issue_created","issue":{"key":"TEST-1"}}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
curl -i http://localhost:8787 \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature: sha256=$SIG" \
  --data "$BODY"
```

**Linear** (`Linear-Signature: <hex>`, includes `webhookTimestamp`):

```bash
SECRET="<your LINEAR_WEBHOOK_SECRET>"
BODY='{"action":"create","type":"Issue","webhookTimestamp":'$(node -e 'process.stdout.write(String(Date.now()))')'}'
SIG=$(printf '%s' "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
curl -i http://localhost:8787 \
  -H "Content-Type: application/json" \
  -H "Linear-Signature: $SIG" \
  -H "Linear-Event: Issue" \
  --data "$BODY"
```

A valid signature returns Cursor's response; a bad one returns `401 Invalid signature`.

## How it works

See `src/index.js`. The Worker reads the raw request body (required for a correct
HMAC), picks the secret based on which signature header is present, compares signatures
in constant time, applies a 60s timestamp check for Linear, then re-POSTs the same bytes
to Cursor with `Authorization: Bearer <CURSOR_AUTH_TOKEN>` plus pass-through source/event
headers (`X-Webhook-Source`, `X-Linear-Event`, `X-Atlassian-Webhook-Identifier`, …).
