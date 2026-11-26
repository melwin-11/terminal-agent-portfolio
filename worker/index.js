import { profile } from "../src/profile.js";
import { providerFor } from "../src/providers.js";
import { newTrace } from "../core/trace.js";
import { Client } from "langsmith";
import { traceable } from "langsmith/traceable";
import { record, dailyCount, recent, purge } from "./trace.js";
import { shouldTraceGeneration } from "./privacy.js";

const MAX_TURNS = 12;
const MAX_CHARS = 1000;
const MAX_BODY = 24000;
const DEFAULT_DAILY_CAP = 300;
const MODEL_TIMEOUT_MS = 15000;
const RETENTION_DAYS = profile.retentionDays ?? 90;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

function clean(input) {
  if (!Array.isArray(input)) return null;
  const turns = input
    .slice(-MAX_TURNS)
    .filter((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));
  while (turns.length && turns[0].role !== "user") turns.shift();
  return turns.length && turns.at(-1).role === "user" ? turns : null;
}

async function sha256(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

async function same(a, b) {
  const [x, y] = await Promise.all([sha256(a), sha256(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export async function tracedGeneration(env, messages, generate, privateMode = false) {
  if (!shouldTraceGeneration(env.LANGSMITH_API_KEY, privateMode)) return generate();

  const agentId = env.LANGSMITH_AGENT_ID || "terminal-agent";
  const environment = env.LANGSMITH_AGENT_ENVIRONMENT || "production";
  const client = new Client({
    apiKey: env.LANGSMITH_API_KEY,
    apiUrl: env.LANGSMITH_ENDPOINT || "https://api.smith.langchain.com",
    timeout: 5000,
    maxRetries: 0,
    blockOnRootRunFinalization: true,
  });
  let generationStarted = false;
  let generated;
  const traced = traceable(
    async ({ messages: modelMessages }) => {
      generationStarted = true;
      generated = await generate(modelMessages);
      return generated;
    },
    {
      name: agentId,
      run_type: "chain",
      project_name: env.LANGSMITH_PROJECT || `${agentId}-${environment}`,
      client,
      tracingEnabled: true,
      metadata: {
        agent_id: agentId,
        environment,
        provider: profile.provider,
      },
      tags: [agentId, environment],
      processOutputs: ({ outputs }) => ({
        answer: outputs?.answer,
        model: outputs?.model,
        total_ms: outputs?.total_ms,
        ttft_ms: outputs?.first,
        usage: outputs?.usage,
        steps: outputs?.steps,
        tools: outputs?.tools,
      }),
    },
  );

  try {
    return await traced({ messages });
  } catch (error) {
    if (generated) {
      console.error("LangSmith trace upload failed; returning the generated answer.");
      return generated;
    }
    if (!generationStarted) {
      console.error("LangSmith trace initialization failed; continuing without tracing.");
      return generate();
    }
    throw error;
  }
}

export async function visitorId(ip, env) {
  if (!env.HASH_SALT) return null;
  const digest = await sha256(`${env.HASH_SALT}:${ip}`);
  return [...digest.slice(0, 8)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function admin(request, env) {
  if (!env.ADMIN_TOKEN || !env.DB) return new Response("Not found", { status: 404 });
  const given = (request.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!(await same(given, env.ADMIN_TOKEN))) return new Response("Unauthorized", { status: 401 });
  const days = Math.min(90, Math.max(1, Number(new URL(request.url).searchParams.get("days")) || 7));
  return json(await recent(env, days));
}

async function chat(request, env, ctx) {
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  if (env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({ key: ip });
    if (!success) return new Response("Rate limited", { status: 429, headers: { "retry-after": "60" } });
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY) return new Response("Request too large", { status: 413 });
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  const messages = clean(payload?.messages);
  if (!messages) return new Response("Invalid messages", { status: 400 });

  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  if (env.DB && (await dailyCount(env, day)) >= (Number(env.DAILY_CAP) || DEFAULT_DAILY_CAP)) {
    return new Response("Daily limit reached", { status: 429 });
  }

  const provider = providerFor(profile.provider);
  const model = env.MODEL || profile.model;

  const trace = {
    id: crypto.randomUUID(),
    ts: now,
    day,
    session: String(payload.session ?? "").slice(0, 64) || null,
    turn: messages.filter((m) => m.role === "user").length,
    visitor: await visitorId(ip, env),
    country: request.cf?.country ?? null,
    client: String(payload.client ?? "").slice(0, 16) || null,
    model,
    private: request.headers.get("x-portfolio-private") === "1",
    question: messages.at(-1).content,
    answer: "",
    status: "ok",
    error: null,
    ttft: null,
    total: null,
    usage: {},
  };

  let selected;
  try {
    const generate = async (modelMessages = messages) => {
      const agentTrace = newTrace(messages.at(-1).content, model);
      const events = [];
      const [{ runAgent }, { setToolConfig }] = await Promise.all([
        import("../core/loop.js"),
        import("../core/tools.js"),
      ]);
      setToolConfig({ githubToken: env.GITHUB_TOKEN });
      try {
        for await (const event of runAgent({
          messages: modelMessages,
          key: env[provider.keyEnv],
          model,
          fallbackModels: profile.fallbackModels,
          thinking: profile.thinking,
          trace: agentTrace,
          timeoutMs: MODEL_TIMEOUT_MS,
        })) events.push(event);
      } catch (err) {
        agentTrace.status = "error";
        agentTrace.error = err.message;
        throw err;
      } finally {
        agentTrace.total = Date.now() - agentTrace.ts;
      }
      return {
        events,
        answer: agentTrace.answer,
        model: agentTrace.model,
        total_ms: agentTrace.total,
        first: agentTrace.ttft,
        usage: agentTrace.usage,
        steps: agentTrace.steps,
        tools: agentTrace.tools,
      };
    };
    selected = await tracedGeneration(env, messages, generate, trace.private);
    trace.model = selected.model;
    trace.usage = selected.usage;
    trace.ttft = selected.first;
    trace.answer = selected.answer;
  } catch (err) {
    trace.status = "error";
    trace.error = String(err.message).slice(0, 300);
    trace.total = Date.now() - now;
    ctx.waitUntil(record(env, trace));
    return new Response("Upstream error", { status: 502 });
  }

  const encoder = new TextEncoder();
  let cancelled = false;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event) => {
        if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      for (const event of selected.events) {
        if (cancelled) break;
        if (event.type === "text") send({ text: event.text });
        else if (event.type === "tool") send({ tool: event });
      }
      if (cancelled) trace.status = "aborted";
      trace.total = Date.now() - now;
      ctx.waitUntil(record(env, trace));
      if (!cancelled) controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      "x-portfolio-model": selected.model,
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url);
    if (pathname === "/health") return json({ ok: true });
    if (pathname === "/admin/traces") return admin(request, env);
    if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
    return chat(request, env, ctx);
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(purge(env, RETENTION_DAYS));
  },
};
