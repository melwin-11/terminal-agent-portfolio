/*
 * agent.js
 *
 * Streams a reply and yields events for the terminal UI:
 *   { type: "text", text }                          a piece of the answer
 *   { type: "tool", name, args, ok, ms, summary }   a tool the agent just used
 *
 * Two transports, chosen automatically:
 *   direct   GEMINI_API_KEY is set. The whole agent runs on this machine through
 *            core/loop.js using knowledge/knowledge.js, and every question is
 *            appended to .traces/traces.jsonl (read it with npm run trace). Meant
 *            for development and local LangSmith tracing. An optional GITHUB_TOKEN
 *            raises GitHub's anonymous rate limit for live lookups, and
 *            PORTFOLIO_TIMEOUT_MS changes the 15 second limit on each model call.
 *            Needs the full repository, because core/ and knowledge/ are not part
 *            of the published package.
 *   hosted   No key is set. The CLI posts { messages, session, client } to the
 *            proxy at PORTFOLIO_API_URL (or profile.endpoint). The proxy owns the
 *            key, the knowledge, the limits and the logging, and replies with
 *            vendor-neutral events {"text"}, {"tool": {...}} or {"error"}. See
 *            worker/index.js.
 *
 * session is a random id created once per run so the proxy can group the turns
 * of one conversation; it is not stored on disk. Setting PORTFOLIO_PRIVATE=1
 * adds the x-portfolio-private header, which tells the proxy to record timing
 * only and never the question or answer text.
 *
 * Tool calling is implemented for the gemini provider only.
 */
import { randomUUID } from "node:crypto";
import { profile } from "./profile.js";
import { providerFor, sseData } from "./providers.js";
import { traceAgent } from "./langsmithTracing.js";

export const sessionId = randomUUID();

const transportMode = () => process.env.PORTFOLIO_TRANSPORT || profile.transport || "auto";

export const isHosted = () => {
  const mode = transportMode();
  if (mode === "hosted") return true;
  if (mode === "local") return false;
  return !process.env[providerFor(profile.provider).keyEnv];
};

async function* direct(messages, signal, key) {
  if (profile.provider !== "gemini") throw new Error("Tool calling is implemented for the gemini provider only.");
  let core;
  try {
    core = {
      ...(await import("../core/loop.js")),
      ...(await import("../core/trace.js")),
      ...(await import("../core/tools.js")),
      ...(await import("../core/localTrace.js")),
    };
  } catch (err) {
    throw new Error(`Local mode needs the full repository (core/ and knowledge/ folders): ${err.message}`);
  }
  core.setToolConfig({ githubToken: process.env.GITHUB_TOKEN });
  const model = process.env.PORTFOLIO_MODEL || profile.model;
  const question = messages.at(-1).content;
  const result = await traceAgent(question, async () => {
    const trace = core.newTrace(question, model);
    const events = [];
    try {
      for await (const event of core.runAgent({
        messages,
        key,
        model,
        fallbackModels: profile.fallbackModels,
        thinking: profile.thinking,
        signal,
        trace,
        timeoutMs: Number(process.env.PORTFOLIO_TIMEOUT_MS) || undefined,
      })) events.push(event);
      return {
        events,
        answer: trace.answer,
        model: trace.model,
        status: trace.status,
        total_ms: Date.now() - trace.ts,
        ttft_ms: trace.ttft,
        steps: trace.steps,
        tools: trace.tools,
      };
    } catch (err) {
      trace.status = signal?.aborted ? "aborted" : "error";
      trace.error = err.message;
      throw err;
    } finally {
      trace.total = Date.now() - trace.ts;
      core.writeLocalTrace(trace);
    }
  });
  for (const event of result.events) yield event;
}

async function* hosted(messages, signal) {
  const res = await fetch(process.env.PORTFOLIO_API_URL || profile.endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(process.env.PORTFOLIO_PRIVATE === "1" ? { "x-portfolio-private": "1" } : {}),
    },
    body: JSON.stringify({ messages, session: sessionId, client: profile.version }),
    signal,
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  for await (const data of sseData(res.body)) {
    if (data.error) throw new Error(data.error);
    if (data.tool) yield { type: "tool", ...data.tool };
    else if (data.text) yield { type: "text", text: data.text };
  }
}

export async function* streamReply(messages, signal) {
  const key = process.env[providerFor(profile.provider).keyEnv];
  if (isHosted()) {
    yield* hosted(messages, signal);
    return;
  }
  if (!key) throw new Error("Local transport requires GEMINI_API_KEY. Use PORTFOLIO_TRANSPORT=hosted or set the key.");
  yield* direct(messages, signal, key);
}
