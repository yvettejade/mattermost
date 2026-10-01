import assert from "node:assert/strict";
import { test } from "node:test";

import worker from "./index.js";

const ENV = {
  CURSOR_AUTH_TOKEN: "test-token",
  CURSOR_WEBHOOK_URL: "https://webhook.test/hook",
  JIRA_WEBHOOK_SECRET: "jira-secret",
  LINEAR_WEBHOOK_SECRET: "linear-secret",
};

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

async function withMockedFetch(impl, run) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

function post(headers, body) {
  return new Request("https://worker.test/webhook", {
    method: "POST",
    headers,
    body,
  });
}

test("rejects an invalid signature even when a bypass header is set", async () => {
  const body = JSON.stringify({ issue: "PROJ-1" });
  let upstreamCalls = 0;

  const response = await withMockedFetch(async () => {
    upstreamCalls += 1;
    return new Response("forwarded", { status: 200 });
  }, () =>
    worker.fetch(
      post(
        {
          "Content-Type": "application/json",
          "X-Bypass-Sig": "1",
          "X-Hub-Signature": "sha256=deadbeef",
        },
        body,
      ),
      ENV,
    ),
  );

  assert.equal(response.status, 401);
  assert.equal(await response.text(), "Invalid signature");
  assert.equal(upstreamCalls, 0);
});

test("rejects an invalid Linear signature even when a bypass header is set", async () => {
  const body = JSON.stringify({ webhookTimestamp: Date.now(), action: "update" });
  let upstreamCalls = 0;

  const response = await withMockedFetch(async () => {
    upstreamCalls += 1;
    return new Response("forwarded", { status: 200 });
  }, () =>
    worker.fetch(
      post(
        {
          "Content-Type": "application/json",
          "X-Bypass-Sig": "1",
          "Linear-Signature": "not-a-real-signature",
        },
        body,
      ),
      ENV,
    ),
  );

  assert.equal(response.status, 401);
  assert.equal(upstreamCalls, 0);
});

test("forwards a valid Jira signature and ignores a bypass header", async () => {
  const body = JSON.stringify({ issue: "PROJ-2" });
  const signature = await hmacSha256Hex(ENV.JIRA_WEBHOOK_SECRET, body);
  let upstreamRequest;

  const response = await withMockedFetch(async (url, init) => {
    upstreamRequest = { url, init };
    return new Response("accepted", { status: 202, headers: { "Content-Type": "text/plain" } });
  }, () =>
    worker.fetch(
      post(
        {
          "Content-Type": "application/json",
          "X-Bypass-Sig": "1",
          "X-Hub-Signature": `sha256=${signature}`,
        },
        body,
      ),
      ENV,
    ),
  );

  assert.equal(response.status, 202);
  assert.equal(await response.text(), "accepted");
  assert.equal(upstreamRequest.url, ENV.CURSOR_WEBHOOK_URL);
  assert.equal(upstreamRequest.init.method, "POST");
  assert.equal(upstreamRequest.init.body, body);
  assert.equal(upstreamRequest.init.headers.Authorization, `Bearer ${ENV.CURSOR_AUTH_TOKEN}`);
});

test("rejects a missing signature header", async () => {
  let upstreamCalls = 0;
  const response = await withMockedFetch(async () => {
    upstreamCalls += 1;
    return new Response("nope", { status: 200 });
  }, () => worker.fetch(post({ "Content-Type": "application/json" }, "{}"), ENV));

  assert.equal(response.status, 401);
  assert.equal(upstreamCalls, 0);
});
