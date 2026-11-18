const INJECTION_PATTERNS = [
  /\b(?:ignore|disregard|forget|bypass|override)\s+(?:all\s+)?(?:of\s+)?(?:the\s+)?(?:previous|prior|above|system|developer|safety|security|your)\s+(?:instructions?|rules?|prompts?|guardrails?)\b/i,
  /\b(?:do not|don't)\s+(?:follow|obey)\s+(?:the\s+)?(?:system|developer|safety|security)\s+(?:instructions?|rules?|prompt)\b/i,
  /\b(?:reveal|show|print|repeat|dump|quote|output|expose|give me)\b[\s\S]{0,100}\b(?:system prompt|hidden (?:system )?(?:prompts?|instructions?)|internal prompt|developer instructions?|api keys?|secrets?|credentials?|environment variables?|knowledge(?:\.js)?|private data|internal traces?|chain of thought)\b/i,
  /\b(?:developer mode|jailbreak|bypass (?:the )?guardrails?)\b/i,
  /\b(?:pretend|act)\s+(?:that\s+)?(?:you are|as)\s+(?:an?\s+)?(?:unrestricted|different|unfiltered|rule[- ]free)\b/i,
];

const PROFILE_TOPIC =
  /\b(?:melwin|robinson|profile|resume|résumé|cv|background|experience|internship|education|degree|university|school|skills?|projects?|research|papers?|publications?|patents?|career|roles?|jobs?|hiring|recruit|availability|mentor(?:ship)?|contact|email|github|linkedin|orcid|portfolio|achievements?|gpa|what does he do|what is he working on|what are you working on|tell me about yourself|who are you|are you an ai|are you a bot)\b/i;

const REDIRECT =
  "I can help with questions about Melwin Robinson's professional profile, experience, projects, research, skills, education, or roles. What would you like to know?";
const SAFE_REFUSAL =
  "I can only share Melwin's approved profile information. Ask about his experience, projects, research, skills, education, or roles.";

function latestUserIndex(messages = []) {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i]?.role === "user") return i;
  return -1;
}

export function isPromptInjection(text = "") {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(String(text)));
}

export function questionPolicy(messages = []) {
  const index = latestUserIndex(messages);
  if (index < 0) return { kind: "redirect", text: REDIRECT };

  const question = String(messages[index]?.content ?? "");
  if (isPromptInjection(question)) return { kind: "refuse", text: SAFE_REFUSAL };

  if (PROFILE_TOPIC.test(question)) return null;

  // Permit natural follow-ups such as "When did he start?" when the recent
  // conversation has already established Melwin as the subject.
  const followUp = /\b(?:he|him|his|that|those|they|them|their|what about|and)\b/i.test(question);
  const priorContext = messages
    .slice(0, index)
    .some((message) => message?.role === "user" && PROFILE_TOPIC.test(String(message.content ?? "")));
  if (followUp && priorContext) return null;

  return { kind: "redirect", text: REDIRECT };
}

export function sanitizeConversation(messages = []) {
  return messages.map((message) => {
    if (message?.role !== "user" || !isPromptInjection(message.content)) return message;
    return { ...message, content: "[An earlier request to override instructions or disclose internal data was omitted.]" };
  });
}
