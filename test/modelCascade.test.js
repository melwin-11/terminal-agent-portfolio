import test from "node:test";
import assert from "node:assert/strict";
import { configuredModels, isFallbackError, withModelFallback } from "../src/modelCascade.js";

test("keeps configured model order and removes duplicates", () => {
  assert.deepEqual(configuredModels("primary", ["backup", "primary", "last"]), ["primary", "backup", "last"]);
});

test("falls back for timeout, rate limit, server, and missing-model failures", () => {
  for (const message of [
    "The model did not respond within 15 seconds.",
    "Request failed (429): rate limited",
    "Request failed (503): service unavailable",
    "Request failed (404): model not found",
  ]) {
    assert.equal(isFallbackError(new Error(message)), true, message);
  }
  assert.equal(isFallbackError(new Error("Request failed (401): invalid API key")), false);
});

test("restarts on the next model after a retryable failure", async () => {
  const tried = [];
  const result = await withModelFallback(["test-primary-fallback", "test-backup-fallback"], async (model) => {
    tried.push(model);
    if (model === "test-primary-fallback") throw new Error("Request failed (503): overloaded");
    return "answer";
  });
  assert.deepEqual(tried, ["test-primary-fallback", "test-backup-fallback"]);
  assert.equal(result, "answer");
});

test("does not fall back for non-retryable errors", async () => {
  const tried = [];
  await assert.rejects(
    withModelFallback(["test-primary-key", "test-backup-key"], async (model) => {
      tried.push(model);
      throw new Error("Request failed (401): invalid API key");
    }),
    /401/,
  );
  assert.deepEqual(tried, ["test-primary-key"]);
});
