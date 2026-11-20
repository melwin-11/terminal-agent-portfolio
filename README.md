# Melwin Robinson — Terminal Portfolio Agent

A conversational portfolio experience for exploring Melwin's engineering work, projects, research, skills, and career interests. The agent uses Gemini, guarded profile tools, Cloudflare Workers, and LangSmith tracing.

## Watch the demo

[Watch the terminal agent demo](https://github.com/user-attachments/assets/979328ac-dc4d-49d2-a78e-ee8c8af4d189)

https://github.com/user-attachments/assets/979328ac-dc4d-49d2-a78e-ee8c8af4d189

## What you can ask

- What projects has Melwin built, and what technologies did he use?
- What is his experience with AI engineering and software development?
- What research has he published or presented, and what is he exploring next?
- What roles and research opportunities is he interested in?
- What is he currently building, and what has he learned from it?

## Architecture

The diagram below illustrates the agent's question-to-answer flow, safeguards, retrieval, model reasoning, tracing, deployment, and improvement cycle.

<p align="center">
  <img width="1358" height="655" alt="Architecture diagram showing the terminal portfolio agent's end-to-end flow" src="https://github.com/user-attachments/assets/41291718-ffd6-4bc7-a33f-ff395ca5f519" />
</p>

## Agent engineering

### Agent orchestration and tool calling

The portfolio assistant is a single tool-using agent. A custom JavaScript orchestration loop sends the conversation, system instructions, and Gemini function declarations to the model. When Gemini requests a function, the loop validates the tool name against an allowlist, executes that read-only profile tool, returns its result to the model, and continues until it can produce a final answer. A turn is capped at five model/tool steps to prevent an open-ended tool cycle.

The tools cover experience, education, projects, research, skills, certifications, public links, and selected live GitHub/ORCID activity. Their descriptions and JSON parameter schemas tell the model when each tool is appropriate. Tool calls, elapsed time, success/failure, and concise result previews are captured in the agent trace.

### Grounded profile retrieval

The source of truth is a curated, structured profile knowledge base maintained separately from the public repository. Profile tools retrieve matching entries by scoring keyword overlap; if a query matches nothing, the tool can return available entry names so the model can retry with a broader query. Public GitHub repository and ORCID publication lookups are available for live activity and cached in memory for one hour.

This implementation does not currently ingest a resume into chunks or use embeddings/vector search. Retrieval is deterministic keyword matching over curated profile records, with selected live-source lookups. The profile knowledge is factual context for responses, not a model-training dataset.

### System prompt and AI security

The system prompt establishes the agent's recruiter-facing role, limits its scope to Melwin's professional profile, directs it to retrieve facts through approved tools, and tells it not to invent missing details. It also treats user messages and retrieved tool results as untrusted data, so text inside a profile entry or public-source result cannot change the agent's instructions. The agent only has read-only profile tools and is not given arbitrary browsing or write actions.

There are additional checks before model invocation: a topic gate redirects unrelated requests, and pattern-based injection checks refuse common attempts to override instructions or extract prompts, credentials, private data, or internal traces. Earlier matching injection text in the conversation is replaced with a neutral marker before the remaining conversation is sent to Gemini. These are layered safeguards against common attacks, not a guarantee against every prompt-injection technique.

### Reliability, tracing, and evaluation

Model selection follows the configured Gemini order. A timed-out request, rate limit, server error, or missing-model response can move the turn to the next configured model; after a transient failure, the failing model is temporarily cooled down to make subsequent turns fail over faster. A fallback restarts the turn from its original conversation, rather than mixing tool-call state between models.

Hosted runs are traced to LangSmith with agent/environment metadata. The trace includes the selected model, answer, latency and token usage, model steps, and tool-call details. The Worker also records operational trace rows in Cloudflare D1 and applies per-IP request limits and a daily request cap before generation.

The current automated evaluation coverage is a small Node test suite for scope filtering, contextual follow-ups, and common prompt-injection handling. There is not yet a golden-question dataset, rubric-based answer scoring, or an LLM-as-judge evaluation pipeline; LangSmith traces provide material to curate and evaluate against as the knowledge base grows.

### Frameworks used

The orchestration currently uses a custom JavaScript loop with Gemini's native function-calling API. LangSmith is integrated for tracing. LangChain and LangGraph are not dependencies in the current codebase, so this project does not claim to use their chains, retrievers, or graph runtime.

## Get in touch

- Email: [melwin.11.robinson@gmail.com](mailto:melwin.11.robinson@gmail.com)
- GitHub: [github.com/melwin-11](https://github.com/melwin-11)
- LinkedIn: [linkedin.com/in/melwin-robinson](https://www.linkedin.com/in/melwin-robinson)

## License

MIT. See [LICENSE](LICENSE).
