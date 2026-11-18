/*
 * trace.mjs
 *
 * Shows how the agent reached its answers when you run it locally. Every question
 * asked with GEMINI_API_KEY set is saved to .traces/traces.jsonl; this prints them.
 *
 * Usage:
 *   node scripts/trace.mjs [count]        the last count traces (default 8), then a summary
 *   node scripts/trace.mjs --summary      only the summary over every trace
 *
 * Per trace: the question, each model step with the tools it asked for, each tool
 * call with its arguments, timing and result summary, then the start of the answer.
 *
 * Summary: how often each tool was used and how often it failed, the questions the
 * agent answered without calling any tool (check whether a tool should have been
 * used), the questions that needed the most model steps, and the slowest answers.
 * When a tool is skipped or chosen wrongly, improve its description in
 * core/tools.js and rerun the question.
 */
import { readFileSync, existsSync } from "node:fs";

const file = new URL("../.traces/traces.jsonl", import.meta.url);
if (!existsSync(file)) {
  console.error("No local traces yet. Run the agent with GEMINI_API_KEY set and ask something.");
  process.exit(1);
}

const rows = readFileSync(file, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const count = Number(process.argv.find((a) => /^\d+$/.test(a))) || 8;
const clip = (s, n = 110) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const when = (ts) => new Date(ts).toISOString().replace("T", " ").slice(0, 16);
const secs = (ms) => (ms == null ? "-" : `${(ms / 1000).toFixed(1)}s`);
const tokens = (u = {}) => `${u.input ?? 0} in / ${u.output ?? 0} out / ${u.thinking ?? 0} think`;
const tally = (list) => list.reduce((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});

if (!process.argv.includes("--summary")) {
  const shown = rows.slice(-count);
  console.log(`Last ${shown.length} of ${rows.length} traces\n`);
  for (const t of shown) {
    console.log(`${when(t.ts)}  ${t.status}  ${secs(t.total)}  first text ${secs(t.ttft)}  steps ${t.steps.length}  tokens ${tokens(t.usage)}`);
    console.log(`  Q  ${clip(t.question)}`);
    for (const s of t.steps) {
      const what = s.first === null ? "no data received" : s.calls.length ? `asked for: ${s.calls.join(", ")}` : "answered in text";
      console.log(`  step ${s.step}  ${secs(s.ms)}  headers ${secs(s.ttfb)}  first data ${secs(s.first)}  attempts ${s.attempts ?? 1}  ${what}`);
    }
    for (const c of t.tools) {
      console.log(`  tool  ${c.name}(${JSON.stringify(c.args)})  ${c.ok ? "ok" : "FAILED"}  ${c.ms} ms  ${c.summary}`);
    }
    if (!t.tools.length) console.log("  tool  none");
    if (t.error) console.log(`  error  ${t.error}`);
    console.log(`  A  ${clip((t.answer ?? "").replace(/\s+/g, " "), 160)}\n`);
  }
}

const calls = rows.flatMap((t) => t.tools);
const used = tally(calls.map((c) => c.name));
const failed = tally(calls.filter((c) => !c.ok).map((c) => c.name));
const noTool = rows.filter((t) => t.status === "ok" && !t.tools.length);
const stepsAvg = rows.length ? (rows.reduce((n, t) => n + t.steps.length, 0) / rows.length).toFixed(1) : "-";

console.log(`Summary over ${rows.length} traces`);
console.log(`  average model steps per question: ${stepsAvg}`);
console.log("  tool usage:");
for (const [name, n] of Object.entries(used).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${name.padEnd(20)}${String(n).padStart(4)} calls${failed[name] ? `, ${failed[name]} failed` : ""}`);
}
if (!calls.length) console.log("    none");
console.log(`  answered without any tool (${noTool.length}):`);
noTool.slice(-8).forEach((t) => console.log(`    ${clip(t.question, 90)}`));
const deep = [...rows].sort((a, b) => b.steps.length - a.steps.length).filter((t) => t.steps.length > 2).slice(0, 3);
if (deep.length) {
  console.log("  needed the most model steps:");
  deep.forEach((t) => console.log(`    ${t.steps.length} steps  ${clip(t.question, 80)}`));
}
console.log("  slowest:");
[...rows].sort((a, b) => (b.total ?? 0) - (a.total ?? 0)).slice(0, 3).forEach((t) => console.log(`    ${secs(t.total)}  ${clip(t.question, 80)}`));
