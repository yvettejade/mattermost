import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import worker from "./index.js";

const env = {
  CURSOR_AUTH_TOKEN: "test-token",
  CURSOR_WEBHOOK_URL: "https://cursor.example.test/webhook",
  JIRA_WEBHOOK_SECRET: "jira-secret",
  LINEAR_WEBHOOK_SECRET: "linear-secret",
};

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("webhook signature", () => {
  it("rejects a Jira body when the bypass header is set and the HMAC is wrong", async () => {
    const upstream = mockUpstream();
    const body = JSON.stringify({ issue: { key: "YJIRA-1" } });
    const response = await worker.fetch(
      post(body, {
        "X-Hub-Signature": "sha256=deadbeef",
        "X-Bypass-Sig": "1",
      }),
      env,
    );

    assert.equal(response.status, 401);
    assert.equal(await response.text(), "Invalid signature");
    assert.equal(upstream.calls, 0);
  });

  it("forwards a Jira body only when the HMAC matches", async () => {
    const upstream = mockUpstream();
    const body = JSON.stringify({ issue: { key: "YJIRA-1" } });
    const signature = await hmacHex(env.JIRA_WEBHOOK_SECRET, body);
    const response = await worker.fetch(
      post(body, {
        "X-Hub-Signature": `sha256=${signature}`,
        "X-Bypass-Sig": "1",
      }),
      env,
    );

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "accepted");
    assert.equal(upstream.calls, 1);
    assert.equal(upstream.authorization, "Bearer test-token");
    assert.equal(upstream.body, body);
  });

  it("rejects a Linear body that omits webhookTimestamp", async () => {
    const upstream = mockUpstream();
    const body = JSON.stringify({ type: "Issue", action: "create" });
    const signature = await hmacHex(env.LINEAR_WEBHOOK_SECRET, body);
    const response = await worker.fetch(
      post(body, { "Linear-Signature": signature }),
      env,
    );

    assert.equal(response.status, 401);
    assert.equal(await response.text(), "Stale webhook timestamp");
    assert.equal(upstream.calls, 0);
  });

  it("rejects a Linear body with a stale webhookTimestamp", async () => {
    const upstream = mockUpstream();
    const body = JSON.stringify({
      type: "Issue",
      webhookTimestamp: Date.now() - 5 * 60_000,
    });
    const signature = await hmacHex(env.LINEAR_WEBHOOK_SECRET, body);
    const response = await worker.fetch(
      post(body, { "Linear-Signature": signature }),
      env,
    );

    assert.equal(response.status, 401);
    assert.equal(upstream.calls, 0);
  });

  it("forwards a Linear body with a fresh webhookTimestamp", async () => {
    const upstream = mockUpstream();
    const body = JSON.stringify({
      type: "Issue",
      webhookTimestamp: Date.now(),
    });
    const signature = await hmacHex(env.LINEAR_WEBHOOK_SECRET, body);
    const response = await worker.fetch(
      post(body, { "Linear-Signature": signature }),
      env,
    );

    assert.equal(response.status, 200);
    assert.equal(await response.text(), "accepted");
    assert.equal(upstream.calls, 1);
    assert.equal(upstream.body, body);
  });
});

function post(body, headers) {
  return new Request("https://worker.example.test/", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
}

function mockUpstream() {
  const seen = { calls: 0, authorization: "", body: "" };
  globalThis.fetch = async (url, init) => {
    seen.calls += 1;
    seen.authorization = init.headers.Authorization;
    seen.body = init.body;
    assert.equal(url, env.CURSOR_WEBHOOK_URL);
    return new Response("accepted", { status: 200 });
  };
  return seen;
}

async function hmacHex(secret, message) {
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
