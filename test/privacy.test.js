import test from "node:test";
import assert from "node:assert/strict";
import { isPrivateMode, shouldPersistConversation } from "../src/privacy.js";
import { redactTraceContent, shouldTraceGeneration } from "../worker/privacy.js";
import { record } from "../worker/trace.js";
import { traceAgent } from "../src/langsmithTracing.js";

test("private mode is opt-in and suppresses local conversation persistence", () => {
  assert.equal(isPrivateMode("1"), true);
  assert.equal(isPrivateMode("0"), false);
  assert.equal(shouldPersistConversation(false), true);
  assert.equal(shouldPersistConversation(true), false);
});

test("private hosted turns bypass LangSmith tracing", () => {
  assert.equal(shouldTraceGeneration("configured-key", false), true);
  assert.equal(shouldTraceGeneration("configured-key", true), false);
  assert.equal(shouldTraceGeneration(undefined, false), false);
});

test("private traces retain operational metadata but redact transcript text", () => {
  const trace = {
    private: true,
    question: "private question",
    answer: "private answer",
    status: "ok",
    total: 123,
    model: "test-model",
  };
  assert.deepEqual(redactTraceContent(trace), {
    ...trace,
    question: null,
    answer: null,
    unanswered: 0,
  });
  assert.equal(redactTraceContent({ ...trace, private: false }).question, "private question");
});

test("record stores no private transcript or Langfuse event", async () => {
  const originalFetch = globalThis.fetch;
  const originalLog = console.log;
  const originalError = console.error;
  let stored;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    throw new Error("private requests must not be sent to Langfuse");
  };
  console.log = () => {};
  console.error = () => {};
  try {
    await record(
      {
        LANGFUSE_PUBLIC_KEY: "public-test-key",
        LANGFUSE_SECRET_KEY: "secret-test-key",
        DB: {
          prepare: () => ({
            bind: (...values) => ({
              run: async () => {
                stored = values;
              },
            }),
          }),
        },
      },
      {
        id: "trace-id",
        ts: Date.now(),
        day: "2026-11-26",
        model: "test-model",
        question: "private question",
        answer: "private answer",
        private: true,
        status: "ok",
        usage: { input: 2, output: 3, thinking: 0 },
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    console.log = originalLog;
    console.error = originalError;
  }
  assert.equal(fetchCalls, 0);
  assert.equal(stored[9], null);
  assert.equal(stored[10], null);
  assert.equal(stored[8], "test-model");
});

test("local private mode bypasses LangSmith without invoking its client", async (t) => {
  const old = {
    key: process.env.LANGSMITH_API_KEY,
    tracing: process.env.LANGSMITH_TRACING,
    privateMode: process.env.PORTFOLIO_PRIVATE,
  };
  t.after(() => {
    for (const [name, value] of Object.entries({
      LANGSMITH_API_KEY: old.key,
      LANGSMITH_TRACING: old.tracing,
      PORTFOLIO_PRIVATE: old.privateMode,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });
  process.env.LANGSMITH_API_KEY = "configured-test-key";
  process.env.LANGSMITH_TRACING = "true";
  process.env.PORTFOLIO_PRIVATE = "1";
  assert.equal(await traceAgent("private question", async () => "answer"), "answer");
});
