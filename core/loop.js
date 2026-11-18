/*
 * loop.js
 *
 * The agent loop. Sends the conversation to Gemini with the tool declarations;
 * when the model asks for tools it runs them, returns the results, and repeats
 * until the model answers in text (at most MAX_STEPS model calls).
 *
 * Yields events for the caller to display:
 *   { type: "text", text }                          a piece of the answer
 *   { type: "tool", name, args, ok, ms, summary }   one finished tool call
 *
 * The trace object passed in is filled as the loop runs (see trace.js). Every
 * model call gets a steps entry with its timing: ttfb is the time until response
 * headers arrived, first the time until the first data arrived, ms the time the
 * call took in total, attempts how many tries it needed. A stalled call is
 * therefore visible as a step with a large ttfb or first and no data.
 *
 * Reliability: a complete turn is buffered and tried against configured models
 * in order. Each model call is cut off after timeoutMs (default 15 seconds).
 * Timeouts, 429s, 5xxs and missing-model errors move to the next model; other
 * errors stop immediately. A user interrupt stops the cascade immediately.
 *
 * Gemini 3 requirement: every part the model returns must be sent back exactly as
 * received, because function calls carry encrypted thought signatures and a
 * request that omits them is rejected with a 400 error. In streaming a signature
 * can arrive in an otherwise empty part, so all parts of every chunk are kept in
 * order and nothing is merged or filtered. Function results go back in a
 * "user" turn, in the same order as the calls, with the call id when one was given.
 *
 * Runs in Node and in the Worker.
 */
import { providers, upstreamRequest, sseData } from "../src/providers.js";
import { buildSystem } from "./persona.js";
import { declarations, runTool } from "./tools.js";
import { addUsage } from "./trace.js";
import { configuredModels, withModelFallback } from "../src/modelCascade.js";
import { questionPolicy, sanitizeConversation } from "./policy.js";

const MAX_STEPS = 5;
const PREVIEW_CHARS = 400;
const DEFAULT_TIMEOUT_MS = 15000;
const toContent = (m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] });

async function describeFailure(res) {
  const raw = await res.text().catch(() => "");
  let detail = raw;
  try {
    const parsed = JSON.parse(raw);
    detail = (Array.isArray(parsed) ? parsed[0] : parsed)?.error?.message ?? raw;
  } catch {
    detail = raw;
  }
  return `Request failed (${res.status})${detail ? `: ${String(detail).slice(0, 160)}` : ""}`;
}

function guard(signal, ms) {
  const controller = new AbortController();
  const relay = () => controller.abort();
  signal?.addEventListener("abort", relay, { once: true });
  const timer = setTimeout(relay, ms);
  return {
    signal: controller.signal,
    release() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", relay);
    },
  };
}

async function* runAgentForModel({ messages, key, model, thinking, signal, trace, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const gemini = providers.gemini;
  const system = buildSystem();
  const contents = messages.map(toContent);

  for (let step = 1; step <= MAX_STEPS; step++) {
    const began = Date.now();
    const rec = { step, ms: null, ttfb: null, first: null, attempts: 0, calls: [], usage: {} };
    trace.steps.push(rec);
    let parts = [];

    try {
      for (let attempt = 1; attempt <= 1; attempt++) {
        rec.attempts = attempt;
        const { url, init } = upstreamRequest("gemini", { model, system, contents, tools: declarations, key, thinking });
        const timer = guard(signal, timeoutMs);
        parts = [];
        rec.usage = {};
        try {
          const res = await fetch(url, { ...init, signal: timer.signal });
          rec.ttfb = Date.now() - began;
          if (!res.ok) throw new Error(await describeFailure(res));
          for await (const data of sseData(res.body)) {
            rec.first ??= Date.now() - began;
            const text = gemini.text(data);
            const seen = gemini.usage(data);
            if (seen) for (const [k, v] of Object.entries(seen)) if (v != null) rec.usage[k] = v;
            parts.push(...(data.candidates?.[0]?.content?.parts ?? []));
            if (text) {
              trace.ttft ??= Date.now() - trace.ts;
              trace.answer += text;
              yield { type: "text", text };
            }
          }
          break;
        } catch (err) {
          if (signal?.aborted) throw err;
          const timedOut = timer.signal.aborted;
          const message = timedOut
            ? `The model did not respond within ${timeoutMs / 1000} seconds (step ${step}, attempt ${attempt}).`
            : err.message;
          throw timedOut ? new Error(message) : err;
        } finally {
          timer.release();
        }
      }
    } finally {
      rec.ms = Date.now() - began;
    }

    const calls = parts.filter((p) => p.functionCall);
    addUsage(trace.usage, rec.usage);
    rec.calls = calls.map((p) => p.functionCall.name);
    if (!calls.length) return;

    contents.push({ role: "model", parts });
    const replies = [];
    for (const { functionCall: call } of calls) {
      const args = call.args ?? {};
      const started = Date.now();
      let ok = true;
      let result;
      let summary;
      try {
        ({ result, summary } = await runTool(call.name, args));
      } catch (err) {
        ok = false;
        result = { error: err.message };
        summary = err.message;
      }
      const ms = Date.now() - started;
      const json = JSON.stringify(result);
      trace.tools.push({ step, name: call.name, args, ok, ms, size: json.length, summary, preview: json.slice(0, PREVIEW_CHARS) });
      yield { type: "tool", name: call.name, args, ok, ms, summary };
      replies.push({ functionResponse: { ...(call.id ? { id: call.id } : {}), name: call.name, response: { result } } });
    }
    contents.push({ role: "user", parts: replies });
  }
  throw new Error("The agent used too many tool steps without answering.");
}

export async function* runAgent(options) {
  const { model, signal, trace } = options;
  const policy = questionPolicy(options.messages);
  if (policy) {
    trace.answer = policy.text;
    trace.status = "ok";
    yield { type: "text", text: policy.text };
    return;
  }
  const safeMessages = sanitizeConversation(options.messages);
  const models = configuredModels(model, options.fallbackModels ?? []);
  const result = await withModelFallback(models, async (candidate) => {
    const attemptTrace = {
      ...trace,
      model: candidate,
      answer: "",
      status: "ok",
      error: null,
      ttft: null,
      steps: [],
      tools: [],
      usage: {},
    };
    const events = [];
    for await (const event of runAgentForModel({ ...options, messages: safeMessages, model: candidate, trace: attemptTrace })) {
      events.push(event);
    }
    return { trace: attemptTrace, events };
  });
  Object.assign(trace, result.trace);
  for (const event of result.events) yield event;
}
