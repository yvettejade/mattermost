import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, it } from "node:test";

import worker from "./index.js";

const ENV = {
  CURSOR_AUTH_TOKEN: "test-cursor-token",
  CURSOR_WEBHOOK_URL: "http://127.0.0.1:9/cursor-webhook",
  JIRA_WEBHOOK_SECRET: "jira-test-secret",
  LINEAR_WEBHOOK_SECRET: "linear-test-secret",
};

function sign(secret, body) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("webhook HMAC gate", () => {
  let calls;
  let originalFetch;

  beforeEach(() => {
    calls = [];
    originalFetch = globalThis.fetch;
    globalThis.fetch = async (url, init) => {
      calls.push({ url, init });
      return new Response("accepted", {
        status: 202,
        headers: { "content-type": "text/plain" },
      });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("rejects X-Bypass-Sig when the HMAC is invalid (CWE-807)", async () => {
    const body = JSON.stringify({ issue: "MM-1" });
    const request = new Request("https://worker.test/hook", {
      method: "POST",
      headers: {
        "X-Bypass-Sig": "1",
        "X-Hub-Signature": "sha256=deadbeef",
        "Content-Type": "application/json",
      },
      body,
    });

    const response = await worker.fetch(request, ENV);

    assert.equal(response.status, 401);
    assert.equal(await response.text(), "Invalid signature");
    assert.equal(calls.length, 0);
  });

  it("ignores X-Bypass-Sig and still requires a valid Jira HMAC", async () => {
    const body = JSON.stringify({ issue: "MM-1" });
    const request = new Request("https://worker.test/hook", {
      method: "POST",
      headers: {
        "X-Bypass-Sig": "1",
        "X-Hub-Signature": `sha256=${sign(ENV.JIRA_WEBHOOK_SECRET, body)}`,
      },
      body,
    });

    const response = await worker.fetch(request, ENV);

    assert.equal(response.status, 202);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, ENV.CURSOR_WEBHOOK_URL);
    assert.equal(calls[0].init.headers.Authorization, `Bearer ${ENV.CURSOR_AUTH_TOKEN}`);
    assert.equal(calls[0].init.body, body);
  });

  it("rejects a forged Jira signature and does not call upstream", async () => {
    const body = JSON.stringify({ issue: "MM-1" });
    const request = new Request("https://worker.test/hook", {
      method: "POST",
      headers: { "X-Hub-Signature": "sha256=00" },
      body,
    });

    const response = await worker.fetch(request, ENV);

    assert.equal(response.status, 401);
    assert.equal(calls.length, 0);
  });

  it("rejects X-Bypass-Sig for Linear when the HMAC is invalid", async () => {
    const body = JSON.stringify({ webhookTimestamp: Date.now(), type: "Issue" });
    const request = new Request("https://worker.test/hook", {
      method: "POST",
      headers: {
        "X-Bypass-Sig": "1",
        "Linear-Signature": "not-a-real-signature",
      },
      body,
    });

    const response = await worker.fetch(request, ENV);

    assert.equal(response.status, 401);
    assert.equal(calls.length, 0);
  });
});
