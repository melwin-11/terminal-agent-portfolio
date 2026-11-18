/*
 * ping.mjs
 *
 * Finds out where the time goes when the agent feels slow. It runs two real
 * questions through the same agent loop the terminal uses, one that needs no tool
 * and one that needs a tool, and prints the timing of every model call.
 *
 * Usage:
 *   $env:GEMINI_API_KEY="..."; node scripts/ping.mjs
 *   node scripts/ping.mjs --model gemini-3.5-flash-lite
 *   node scripts/ping.mjs --thinking MINIMAL --timeout 90
 *
 * Per model call:
 *   headers     time until the API started answering (connection and queueing)
 *   first data  time until the first piece of the reply arrived (model start-up and thinking)
 *   total       time for the whole call
 *   attempts    2 means the first try failed or stalled and was retried
 *   thinking    tokens the model spent reasoning; large values mean slow answers
 *
 * Compare models and thinking levels with the flags. If the numbers are fine here
 * but the terminal is slow, the problem is not the model.
 */
import { profile } from "../src/profile.js";
import { runAgent } from "../core/loop.js";
import { newTrace } from "../core/trace.js";

const key = process.env.GEMINI_API_KEY;
if (!key) {
  console.error("Set GEMINI_API_KEY first.");
  process.exit(1);
}

const flag = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const model = flag("model") ?? process.env.PORTFOLIO_MODEL ?? profile.model;
const thinking = flag("thinking") ?? profile.thinking;
const timeoutMs = (Number(flag("timeout")) || 60) * 1000;
const secs = (ms) => (ms == null ? "-" : `${(ms / 1000).toFixed(1)}s`);

console.log(`model ${model}, thinking ${thinking}, timeout ${timeoutMs / 1000}s\n`);

const questions = ["Say hello in five words.", `What skills does ${profile.name} have?`];
const steps = [];

for (const question of questions) {
  const trace = newTrace(question, model);
  const began = Date.now();
  let error = null;
  try {
    for await (const event of runAgent({ messages: [{ role: "user", content: question }], key, model, thinking, trace, timeoutMs }));
  } catch (err) {
    error = err.message;
  }
  console.log(`"${question}"  ${error ? "FAILED" : "ok"}  ${secs(Date.now() - began)}  tools: ${trace.tools.map((t) => t.name).join(", ") || "none"}`);
  for (const s of trace.steps) {
    steps.push(s);
    console.log(
      `  step ${s.step}  headers ${secs(s.ttfb)}  first data ${secs(s.first)}  total ${secs(s.ms)}  attempts ${s.attempts}  thinking ${s.usage?.thinking ?? "-"} tokens`,
    );
  }
  if (error) console.log(`  error: ${error}`);
  if (!error) console.log(`  answer: ${trace.answer.replace(/\s+/g, " ").slice(0, 120)}`);
  console.log();
}

console.log("Reading the numbers:");
const slowHeaders = steps.some((s) => (s.ttfb ?? 0) > 5000);
const slowStart = steps.some((s) => s.first != null && s.first - (s.ttfb ?? 0) > 10000);
const stalled = steps.some((s) => s.first === null);
const retried = steps.some((s) => s.attempts > 1);
if (!slowHeaders && !slowStart && !stalled && !retried) console.log("  Nothing looks slow. If the terminal still feels slow, tell me which question and what the trace shows.");
if (slowHeaders) console.log("  Slow headers: connection or API queueing. Check your network, VPN or proxy, and try another model.");
if (slowStart) console.log("  Slow first data: the model is slow to start. Try --thinking MINIMAL or a lighter model such as gemini-3.5-flash-lite.");
if (stalled) console.log("  No data arrived on at least one call: the API accepted the request and then stayed silent.");
if (retried) console.log("  Retries happened: the API returned errors or stalled on the first try.");
