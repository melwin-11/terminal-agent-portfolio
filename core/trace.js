export function newTrace(question, model) {
  return {
    ts: Date.now(),
    question,
    model,
    answer: "",
    status: "ok",
    error: null,
    ttft: null,
    total: null,
    steps: [],
    tools: [],
    usage: {},
  };
}

export function addUsage(total, usage) {
  for (const [key, value] of Object.entries(usage ?? {})) {
    if (value != null) total[key] = (total[key] ?? 0) + value;
  }
}
