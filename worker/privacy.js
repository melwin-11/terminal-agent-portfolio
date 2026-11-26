export function shouldTraceGeneration(hasLangSmithKey, privateMode) {
  return Boolean(hasLangSmithKey) && !privateMode;
}

export function redactTraceContent(trace) {
  if (!trace.private) return { ...trace };
  return { ...trace, question: null, answer: null, unanswered: 0 };
}
