export async function traceAgent(question, run) {
  if (!process.env.LANGSMITH_API_KEY || process.env.LANGSMITH_TRACING === "false") {
    return run();
  }

  const { traceable } = await import("langsmith/traceable");
  const agentId = process.env.LANGSMITH_AGENT_ID || "terminal-agent";
  const environment = process.env.LANGSMITH_AGENT_ENVIRONMENT || "local";
  const tracedRun = traceable(async ({ question: tracedQuestion }) => run(tracedQuestion), {
    name: agentId,
    project_name: process.env.LANGSMITH_PROJECT || `${agentId}-${environment}`,
    metadata: {
      agent_id: agentId,
      environment,
      provider: "gemini",
    },
    tags: [agentId, environment],
  });
  return tracedRun({ question });
}
