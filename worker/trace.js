export const UNANSWERED =
  /\b(?:do not|don't|does not|doesn't) have (?:that |this |any |enough |specific )?(?:information|details|data)\b/i;

async function saveD1(env, r) {
  if (!env.DB) return;
  await env.DB.prepare(
    `INSERT INTO traces (id, ts, day, session, turn, visitor, country, client, model, question, answer,
       status, error, unanswered, ttft_ms, total_ms, tokens_in, tokens_out, tokens_think)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)`,
  )
    .bind(
      r.id, r.ts, r.day, r.session ?? null, r.turn ?? null, r.visitor ?? null, r.country ?? null,
      r.client ?? null, r.model ?? null, r.question ?? null, r.answer ?? null, r.status, r.error ?? null,
      r.unanswered, r.ttft ?? null, r.total ?? null, r.usage.input ?? null, r.usage.output ?? null,
      r.usage.thinking ?? null,
    )
    .run();
}

async function sendLangfuse(env, r) {
  if (!env.LANGFUSE_PUBLIC_KEY || !env.LANGFUSE_SECRET_KEY) return;
  const host = (env.LANGFUSE_HOST || "https://cloud.langfuse.com").replace(/\/$/, "");
  const start = new Date(r.ts).toISOString();
  const end = new Date(r.ts + (r.total ?? 0)).toISOString();
  const first = r.ttft == null ? undefined : new Date(r.ts + r.ttft).toISOString();
  const batch = [
    {
      id: crypto.randomUUID(),
      type: "trace-create",
      timestamp: start,
      body: {
        id: r.id,
        name: "portfolio-question",
        sessionId: r.session ?? undefined,
        userId: r.visitor ?? undefined,
        input: r.question,
        output: r.answer,
        tags: [r.status, ...(r.unanswered ? ["unanswered"] : [])],
        metadata: { country: r.country, turn: r.turn, client: r.client },
        timestamp: start,
      },
    },
    {
      id: crypto.randomUUID(),
      type: "generation-create",
      timestamp: start,
      body: {
        id: crypto.randomUUID(),
        traceId: r.id,
        name: "answer",
        model: r.model,
        input: r.question,
        output: r.answer,
        startTime: start,
        endTime: end,
        completionStartTime: first,
        usage: { input: r.usage.input, output: r.usage.output, unit: "TOKENS" },
        metadata: { thinkingTokens: r.usage.thinking },
        level: r.status === "ok" ? "DEFAULT" : "ERROR",
        statusMessage: r.error ?? undefined,
      },
    },
  ];
  const res = await fetch(`${host}/api/public/ingestion`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Basic ${btoa(`${env.LANGFUSE_PUBLIC_KEY}:${env.LANGFUSE_SECRET_KEY}`)}`,
    },
    body: JSON.stringify({ batch }),
  });
  if (!res.ok) throw new Error(`Langfuse responded ${res.status}`);
}

export async function record(env, trace) {
  const keep = !trace.private;
  const row = {
    ...trace,
    question: keep ? trace.question : null,
    answer: keep ? trace.answer : null,
    unanswered: keep && UNANSWERED.test(trace.answer) ? 1 : 0,
  };
  console.log(
    JSON.stringify({
      evt: "chat", id: row.id, status: row.status, ttft: row.ttft, total: row.total,
      tokens: row.usage, country: row.country, unanswered: row.unanswered, private: trace.private,
    }),
  );
  const results = await Promise.allSettled([saveD1(env, row), keep ? sendLangfuse(env, row) : null]);
  for (const r of results) if (r.status === "rejected") console.error("trace export failed:", r.reason?.message);
}

export async function dailyCount(env, day) {
  try {
    const row = await env.DB.prepare("SELECT COUNT(*) AS n FROM traces WHERE day = ?1").bind(day).first();
    return row?.n ?? 0;
  } catch (err) {
    console.error("daily count failed:", err.message);
    return 0;
  }
}

export async function recent(env, days) {
  const since = Date.now() - days * 86400000;
  const { results } = await env.DB.prepare("SELECT * FROM traces WHERE ts >= ?1 ORDER BY ts DESC LIMIT 2000")
    .bind(since)
    .all();
  return results;
}

export async function purge(env, days) {
  if (!env.DB) return;
  await env.DB.prepare("DELETE FROM traces WHERE ts < ?1").bind(Date.now() - days * 86400000).run();
}
