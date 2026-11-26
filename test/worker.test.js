import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import worker, { tracedGeneration, visitorId } from "../worker/index.js";

globalThis.crypto ??= webcrypto;

const context = { waitUntil() {} };
const call = (request, env = {}) => worker.fetch(request, env, context);

test("health endpoint is available without private profile data", async () => {
  const response = await call(new Request("https://worker.test/health"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true });
});

test("does not derive a visitor hash without a configured secret salt", async () => {
  assert.equal(await visitorId("203.0.113.10", {}), null);
  const first = await visitorId("203.0.113.10", { HASH_SALT: "test-salt-a" });
  const second = await visitorId("203.0.113.10", { HASH_SALT: "test-salt-b" });
  assert.match(first, /^[a-f0-9]{16}$/);
  assert.notEqual(first, second);
});

test("private turns bypass the actual LangSmith wrapper", async () => {
  let generated = 0;
  const result = await tracedGeneration(
    { LANGSMITH_API_KEY: "configured-test-key" },
    [{ role: "user", content: "private question" }],
    async () => {
      generated += 1;
      return { answer: "answer" };
    },
    true,
  );
  assert.equal(generated, 1);
  assert.deepEqual(result, { answer: "answer" });
});

test("rejects unsupported methods", async () => {
  const response = await call(new Request("https://worker.test/", { method: "GET" }));
  assert.equal(response.status, 405);
});

test("rate limits a request before parsing or invoking the model", async () => {
  let checked = false;
  const response = await call(
    new Request("https://worker.test/", { method: "POST", body: "not json" }),
    { RATE_LIMITER: { limit: async () => ((checked = true), { success: false }) } },
  );
  assert.equal(checked, true);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
});

test("rejects oversized and malformed request bodies", async () => {
  const oversized = await call(new Request("https://worker.test/", { method: "POST", body: "x".repeat(24001) }));
  assert.equal(oversized.status, 413);

  const malformed = await call(new Request("https://worker.test/", { method: "POST", body: "{" }));
  assert.equal(malformed.status, 400);
  assert.equal(await malformed.text(), "Invalid JSON");
});

test("rejects invalid message shapes without loading profile tools", async () => {
  const response = await call(
    new Request("https://worker.test/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "system", content: "not allowed" }] }),
    }),
  );
  assert.equal(response.status, 400);
  assert.equal(await response.text(), "Invalid messages");
});

test("enforces the configured daily cap before model generation", async () => {
  const response = await call(
    new Request("https://worker.test/", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Tell me about Melwin" }] }),
    }),
    {
      DAILY_CAP: "300",
      DB: {
        prepare: () => ({ bind: () => ({ first: async () => ({ n: 300 }) }) }),
      },
    },
  );
  assert.equal(response.status, 429);
  assert.equal(await response.text(), "Daily limit reached");
});
