# Setting up a source webhook → Cursor automation (via a Cloudflare Worker proxy)

A reusable runbook for wiring any source webhook (Jira, Linear, …) to a Cursor
automation webhook trigger. Notes call out where Jira vs Linear differ.

## Background: why a proxy is needed at all

Jira and Linear webhooks **cannot** attach a custom `Authorization` header (their
"Secret" field is only for HMAC signing). Cursor's automation webhook trigger
**requires** `Authorization: Bearer <token>`. So you need a small relay that receives
the source webhook, verifies it, and re-sends it to Cursor with the bearer header.
A Cloudflare Worker is a good fit (free, no servers to manage).

```
Source (Jira/Linear)  ──▶  Cloudflare Worker (verify + add auth header)  ──▶  Cursor automation
```

---

## Step 1 — Create the Cursor automation and grab its webhook details

1. In Cursor, create/open the automation and give it a **webhook trigger**.
2. After saving, copy two things it shows you:
   - **Webhook URL** — like `https://api2.cursor.sh/automations/webhook/<automation-id>`
   - **Auth token** — like `crsr_…` (used as `Authorization: Bearer <token>`)
3. Treat the token like a password. Don't paste it into chats/docs; if you do, regenerate it.

---

## Step 2 — Scaffold the proxy project

Pick a folder (its own directory is cleanest) and create these files.

`package.json`:

```json
{
  "name": "cursor-webhook-proxy",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy"
  },
  "devDependencies": {
    "wrangler": "^4.0.0"
  }
}
```

`wrangler.toml` (set `name` and the real Cursor URL):

```toml
name = "cursor-webhook-proxy"
main = "src/index.js"
compatibility_date = "2026-06-01"

[vars]
CURSOR_WEBHOOK_URL = "https://api2.cursor.sh/automations/webhook/PUT_YOUR_AUTOMATION_ID_HERE"
```

`.gitignore`:

```
node_modules/
.dev.vars
.wrangler/
```

`src/index.js` — the relay (handles both Jira and Linear, verifies signatures, adds the bearer header):

```javascript
const TIMESTAMP_TOLERANCE_MS = 60_000;

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }
    if (!env.CURSOR_AUTH_TOKEN || !env.CURSOR_WEBHOOK_URL) {
      return new Response("Misconfigured: missing Cursor bindings", { status: 500 });
    }

    // Raw body is required — signatures are computed over the exact bytes.
    const rawBody = await request.text();

    const source = request.headers.get("x-hub-signature")
      ? "jira"
      : request.headers.get("linear-signature")
        ? "linear"
        : null;
    if (!source) {
      return new Response("Missing signature header", { status: 401 });
    }

    const secret = source === "jira" ? env.JIRA_WEBHOOK_SECRET : env.LINEAR_WEBHOOK_SECRET;
    if (!secret) {
      return new Response(`Misconfigured: missing ${source} secret`, { status: 500 });
    }

    const provided =
      source === "jira"
        ? (request.headers.get("x-hub-signature") || "").split("=").pop()
        : request.headers.get("linear-signature") || "";
    const expected = await hmacSha256Hex(secret, rawBody);
    if (!timingSafeEqual(provided, expected)) {
      return new Response("Invalid signature", { status: 401 });
    }

    // Linear includes a timestamp for replay protection; Jira does not.
    if (source === "linear") {
      try {
        const ts = JSON.parse(rawBody)?.webhookTimestamp;
        if (typeof ts === "number" && Math.abs(Date.now() - ts) > TIMESTAMP_TOLERANCE_MS) {
          return new Response("Stale webhook timestamp", { status: 401 });
        }
      } catch {
        return new Response("Body is not valid JSON", { status: 400 });
      }
    }

    const upstream = await fetch(env.CURSOR_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.CURSOR_AUTH_TOKEN}`,
        "X-Webhook-Source": source,
      },
      body: rawBody,
    });
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "text/plain" },
    });
  },
};

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
```

> Tip: if this proxy only serves one source, you can delete the other branch. But leaving both is harmless.

---

## Step 3 — Deploy to Cloudflare

```bash
cd cursor-webhook-proxy
npm install
npx wrangler login          # opens a browser once
npx wrangler deploy         # prints your Worker URL
```

Copy the printed URL, e.g. `https://cursor-webhook-proxy.<your-subdomain>.workers.dev`.
On a brand-new Cloudflare account it'll also ask you to pick a `*.workers.dev` subdomain.

> Gotcha: if `npm install` errors with `EPERM … package-lock.json` because of a stray
> `package.json` in a parent/home dir, run `npm install --workspaces=false`.

---

## Step 4 — Set the secrets (never commit these)

```bash
# Required: the Cursor bearer token, WITHOUT the "Bearer " prefix
npx wrangler secret put CURSOR_AUTH_TOKEN

# Set the secret for whichever source you're wiring up:
npx wrangler secret put JIRA_WEBHOOK_SECRET
# or
npx wrangler secret put LINEAR_WEBHOOK_SECRET
```

Each command prompts interactively (masked input). Secrets apply to the live Worker
immediately — no redeploy needed. To set non-interactively, use
`printf %s 'value' | npx wrangler secret put NAME` (use `printf`, not `echo`, so no
trailing newline corrupts the secret).

---

## Step 5 — Point the source at the Worker

### Jira
1. **Settings → System → WebHooks → Create a WebHook.**
2. **URL** = your Worker URL.
3. **Secret** = generate/enter a value, then store that *exact same value* with
   `npx wrangler secret put JIRA_WEBHOOK_SECRET`. (Jira shows the secret only once.)
4. **Events** = tick what you need. Remember: dragging a card between board columns is
   **Issue → updated** (a status change), not a "Board" event.
5. **Exclude body** = leave **unchecked** (Cursor needs the JSON).
6. **Status** = Enabled. Save.

### Linear
1. **Settings → API → Webhooks → New webhook.**
2. **URL** = your Worker URL.
3. Select events, save, then open the webhook to copy its **Signing secret** and store it
   with `npx wrangler secret put LINEAR_WEBHOOK_SECRET`.

---

## Step 6 — Test and watch logs

Stream live logs, then trigger a real event:

```bash
npx wrangler tail cursor-webhook-proxy --format pretty
```

Trigger an event (move a Jira card / change a Linear issue). You want to see the request
arrive and the Worker return a `200`. To make the outcome obvious, you can temporarily
add logging right before the `return`:

```javascript
console.log(JSON.stringify({ source, cursorStatus: upstream.status }));
```

…then redeploy, test, and remove it once confirmed (so response bodies aren't written to logs).

---

## Step 7 — Interpreting results / troubleshooting

| What you see | Meaning | Fix |
|---|---|---|
| Nothing in `wrangler tail` | Source never sent the request | Wrong event selected, webhook not saved/enabled, or a JQL filter excludes the issue |
| `401 Missing signature header` | Request had no `X-Hub-Signature`/`Linear-Signature` | You're hitting it with a non-source client; real Jira/Linear requests include it |
| `401 Invalid signature` | Reached Worker, but secret mismatch | The source's Secret must be byte-for-byte equal to the stored `*_WEBHOOK_SECRET` |
| Cursor returns `401 …missing required scope: automation:<id>` | Wrong/placeholder `CURSOR_WEBHOOK_URL`, or token not valid for that automation | Fix the URL in `wrangler.toml` + redeploy; re-set `CURSOR_AUTH_TOKEN` |
| Cursor returns `200 {"success":true}` | Working | Done |

---

## Replicating for *multiple* automations

Each Cursor automation has its own URL + token, so the simplest model is **one Worker per
automation** (different `name` in `wrangler.toml`, different `CURSOR_WEBHOOK_URL`, its own
secrets). If you'd rather run a single Worker for many automations, route by URL path —
e.g. have the Worker read `new URL(request.url).pathname` and map `/deploys`, `/triage`,
etc. to different `CURSOR_WEBHOOK_URL_*` / token pairs, and give each source a
path-specific Worker URL.
