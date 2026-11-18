export const providers = {
  gemini: {
    keyEnv: "GEMINI_API_KEY",
    request({ model, system, messages, contents, tools, key, thinking }) {
      return {
        url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`,
        headers: { "x-goog-api-key": key },
        body: {
          systemInstruction: { parts: [{ text: system }] },
          contents:
            contents ??
            messages.map((m) => ({
              role: m.role === "assistant" ? "model" : "user",
              parts: [{ text: m.content }],
            })),
          ...(tools ? { tools: [{ functionDeclarations: tools }] } : {}),
          generationConfig: {
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingLevel: thinking },
          },
        },
      };
    },
    text(data) {
      if (data.error) {
        const code = data.error.code;
        const detail = data.error.message || "The model reported an error.";
        throw new Error(code ? `Request failed (${code}): ${detail}` : detail);
      }
      if (data.promptFeedback?.blockReason) throw new Error("The request was blocked by the model's safety filters.");
      return (data.candidates?.[0]?.content?.parts ?? [])
        .filter((part) => !part.thought)
        .map((part) => part.text ?? "")
        .join("");
    },
    usage(data) {
      const u = data.usageMetadata;
      return u ? { input: u.promptTokenCount, output: u.candidatesTokenCount, thinking: u.thoughtsTokenCount } : null;
    },
  },
};

export function providerFor(name) {
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown provider "${name}". Use one of: ${Object.keys(providers).join(", ")}.`);
  return provider;
}

export function upstreamRequest(name, options) {
  const { url, headers, body } = providerFor(name).request(options);
  return {
    url,
    init: {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    },
  };
}

export async function* sseData(body) {
  const decoder = new TextDecoder();
  let pending = "";
  const parse = (event) => {
    const line = event.split(/\r?\n/).find((l) => l.startsWith("data:"));
    return line ? JSON.parse(line.slice(5).trim()) : null;
  };
  for await (const chunk of body) {
    pending += decoder.decode(chunk, { stream: true });
    const events = pending.split(/\r?\n\r?\n/);
    pending = events.pop();
    for (const event of events) {
      const data = parse(event);
      if (data) yield data;
    }
  }
  const last = pending.trim() ? parse(pending) : null;
  if (last) yield last;
}

