/**
 * Jira / Linear -> Cursor webhook proxy.
 *
 * Neither Jira nor Linear can attach a custom Authorization header to their
 * outgoing webhooks, but the Cursor automation webhook trigger requires
 * `Authorization: Bearer <token>`. This Worker receives the webhook, verifies
 * its HMAC-SHA256 signature, then forwards the (unmodified) raw body to Cursor
 * with the auth header attached.
 *
 * Source auto-detection by signature header:
 *   - Jira   : `X-Hub-Signature: sha256=<hex>`  (verified with JIRA_WEBHOOK_SECRET)
 *   - Linear : `Linear-Signature: <hex>`         (verified with LINEAR_WEBHOOK_SECRET)
 *
 * Required bindings (see wrangler.toml / secrets):
 *   - CURSOR_AUTH_TOKEN     : Cursor webhook bearer token, without the "Bearer " prefix (secret)
 *   - CURSOR_WEBHOOK_URL    : Cursor automation webhook URL (var)
 *   - JIRA_WEBHOOK_SECRET   : Jira webhook secret   (secret; optional if you don't use Jira)
 *   - LINEAR_WEBHOOK_SECRET : Linear signing secret (secret; optional if you don't use Linear)
 */

const TIMESTAMP_TOLERANCE_MS = 60_000;

export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    if (!env.CURSOR_AUTH_TOKEN || !env.CURSOR_WEBHOOK_URL) {
      return new Response("Proxy is misconfigured: missing Cursor bindings", { status: 500 });
    }

    // Read the raw body exactly as sent. Both Jira and Linear sign the raw
    // bytes, so we must not re-stringify a parsed JSON body or signatures break.
    const rawBody = await request.text();

    const source = detectSource(request);
    if (!source) {
      return new Response("Missing signature header (X-Hub-Signature or Linear-Signature)", {
        status: 401,
      });
    }

    const secret = source === "jira" ? env.JIRA_WEBHOOK_SECRET : env.LINEAR_WEBHOOK_SECRET;
    if (!secret) {
      return new Response(`Proxy is misconfigured: missing ${source} signing secret`, {
        status: 500,
      });
    }

    const expectedSignature = await hmacSha256Hex(secret, rawBody);
    if (!timingSafeEqual(stripSignature(source, request), expectedSignature)) {
      console.log(JSON.stringify({ stage: "verify", source, result: "invalid_signature" }));
      return new Response("Invalid signature", { status: 401 });
    }
    console.log(JSON.stringify({ stage: "verify", source, result: "ok" }));

    // Linear includes a millisecond timestamp we can use for replay protection.
    // Jira does not, so we rely on its idempotency identifier instead.
    if (source === "linear") {
      let payload;
      try {
        payload = JSON.parse(rawBody);
      } catch {
        return new Response("Body is not valid JSON", { status: 400 });
      }
      const ts = payload?.webhookTimestamp;
      if (typeof ts === "number" && Math.abs(Date.now() - ts) > TIMESTAMP_TOLERANCE_MS) {
        return new Response("Stale webhook timestamp", { status: 401 });
      }
    }

    // Forward the verified, unmodified body to Cursor with the bearer token.
    const upstream = await fetch(env.CURSOR_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.CURSOR_AUTH_TOKEN}`,
        "X-Webhook-Source": source,
        // Pass through source event metadata so the automation can use it.
        "X-Linear-Event": request.headers.get("linear-event") ?? "",
        "X-Linear-Delivery": request.headers.get("linear-delivery") ?? "",
        "X-Atlassian-Webhook-Identifier":
          request.headers.get("x-atlassian-webhook-identifier") ?? "",
      },
      body: rawBody,
    });

    const upstreamBody = await upstream.text();
    console.log(
      JSON.stringify({
        stage: "forward",
        source,
        cursorStatus: upstream.status,
        cursorBody: upstreamBody.slice(0, 300),
      }),
    );
    return new Response(upstreamBody, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("content-type") ?? "text/plain" },
    });
  },
};

function detectSource(request) {
  if (request.headers.get("x-hub-signature")) return "jira";
  if (request.headers.get("linear-signature")) return "linear";
  return null;
}

// Returns the hex signature to compare against, normalized per source.
function stripSignature(source, request) {
  if (source === "jira") {
    // Jira sends `method=signature`, e.g. `sha256=<hex>` (WebSub style).
    const raw = request.headers.get("x-hub-signature") ?? "";
    return raw.includes("=") ? raw.slice(raw.indexOf("=") + 1) : raw;
  }
  return request.headers.get("linear-signature") ?? "";
}

async function hmacSha256Hex(secret, message) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
