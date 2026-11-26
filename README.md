# My Terminal Portfolio Agent

I built this conversational portfolio agent to give recruiters a practical way to explore my engineering work, projects, research, skills, and career interests. It uses Gemini for language reasoning, profile tools to retrieve relevant facts, Cloudflare Workers for the hosted service, and LangSmith to trace hosted runs.

## Watch my demo

https://github.com/user-attachments/assets/c60c52de-47c8-4cc4-8af8-1808be4f8e9e

## Questions you can ask me

- What projects have I built, and which technologies did I use?
- What experience do I have in AI engineering and software development?
- What research have I published or presented, and what topics am I exploring?
- Which roles and research opportunities am I looking for?
- What am I currently building, and what have I learned from it?

## How my agent works

The diagram below shows the flow I designed, from a recruiter's question through safeguards, profile retrieval, model reasoning, tracing, deployment, and iteration.

<p align="center">
  <a href="https://github.com/user-attachments/assets/a3059eb0-b2b2-4466-9e2a-92ac3168e1b2">
    <img src="https://github.com/user-attachments/assets/a3059eb0-b2b2-4466-9e2a-92ac3168e1b2" width="100%" alt="Architecture diagram showing the terminal portfolio agent's end-to-end flow">
  </a>
</p>

### Agent orchestration and tool calling

I built a single tool-using agent around a custom JavaScript orchestration loop. For each turn, I send Gemini the conversation, my system instructions, and function declarations that describe the tools the agent can use. When Gemini requests a function, my loop dispatches the call to an approved read-only profile tool, sends the result back to the model, and continues until it produces an answer. I cap a turn at five model/tool steps to prevent an open-ended tool cycle.

I provide tools for experience, education, projects, research, skills, certifications, public links, and selected live GitHub and ORCID activity. Each tool has a description and JSON parameter schema to help Gemini choose it for the question. I record tool names, arguments, duration, success or failure, and a concise result preview in the trace.

### Grounded retrieval from my profile data

I maintain a curated, structured profile knowledge base as the factual source for the agent. The profile tools score records by keyword overlap and return the best matching entries. When nothing matches, a tool can return available entry names so the model can retry with a broader query. For recent public activity, I also query GitHub and ORCID; those results are cached in memory for one hour.

My current retrieval is keyword-based over curated profile records, plus selected live-source lookups. I have not implemented resume chunking, embeddings, or vector search. This profile knowledge is a source of facts for answers, not a model-training dataset.

### System prompt, guardrails, and AI security

I designed the system prompt to define the agent's recruiter-facing role and keep it focused on my professional profile. It instructs the model to retrieve profile facts through approved tools, avoid inventing information, treat user messages and retrieved content as untrusted data, and keep private instructions and credentials confidential. The agent has read-only profile tools; it cannot browse arbitrary user-supplied URLs or change data.

I added checks before model generation: a topic gate redirects unrelated questions, while pattern-based prompt-injection checks refuse common attempts to override instructions or extract prompts, credentials, private data, or internal traces. If an earlier message contains a matching injection pattern, I replace that text with a neutral marker before sending the rest of the conversation to Gemini. These controls provide layered protection against common attacks, but they cannot guarantee detection of every prompt-injection technique.

### Reliability, tracing, and evaluation

I configure Gemini models in priority order. If a request times out or returns a rate-limit, server, or missing-model error, the agent can retry the whole turn on the next configured model. After a transient failure, it temporarily cools down the failing model so later requests can fail over sooner. Restarting the full turn avoids carrying tool-call state between different models.

I integrated LangSmith tracing for hosted runs and attach agent and environment metadata. Traces capture the selected model, answer, latency, token usage, model steps, and tool-call details. The Worker also stores operational trace rows in Cloudflare D1 and applies per-IP request limits and a daily request cap before model generation.

My current automated checks cover request scope, contextual follow-ups, and common prompt-injection cases. I have not yet built a golden-question evaluation dataset, rubric-based answer scoring, or an LLM-as-judge pipeline. I can use reviewed traces to curate that evaluation set as the agent and my profile knowledge evolve.

### Framework choices

I implemented orchestration with a custom JavaScript loop and Gemini's native function-calling API, and I use LangSmith for tracing. LangChain and LangGraph are not currently dependencies in this project, so I do not claim to use their chains, retrievers, or graph runtime.

## Contact me

- Email: [melwin.11.robinson@gmail.com](mailto:melwin.11.robinson@gmail.com)
- GitHub: [github.com/melwin-11](https://github.com/melwin-11)
- LinkedIn: [linkedin.com/in/melwin-robinson](https://www.linkedin.com/in/melwin-robinson)

## License

MIT. See [LICENSE](LICENSE).
