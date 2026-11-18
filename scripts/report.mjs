import { profile } from "../src/profile.js";

const days = Number(process.argv.find((a) => /^\d+$/.test(a))) || 7;
const token = process.env.ADMIN_TOKEN;
if (!token) {
  console.error("Set ADMIN_TOKEN to the same value as the Worker secret.");
  process.exit(1);
}

const base = process.env.PORTFOLIO_API_URL || profile.endpoint;
const res = await fetch(new URL(`/admin/traces?days=${days}`, base), {
  headers: { authorization: `Bearer ${token}` },
});
if (!res.ok) {
  console.error(`Request failed (${res.status})`);
  process.exit(1);
}
const rows = await res.json();
if (process.argv.includes("--json")) {
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}

const pct = (values, p) => {
  if (!values.length) return "-";
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))]);
};
const tally = (list, key) => list.reduce((m, r) => ((m[key(r)] = (m[key(r)] ?? 0) + 1), m), {});
const top = (obj, n = 5) =>
  Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${v}`).join(", ") || "-";
const sum = (key) => rows.reduce((t, r) => t + (r[key] ?? 0), 0);
const clip = (s, n = 100) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const when = (ts) => new Date(ts).toISOString().replace("T", " ").slice(0, 16);
const line = (label, value) => console.log(`  ${label.padEnd(24)}${value}`);
const section = (title) => console.log(`\n${title}`);

const status = tally(rows, (r) => r.status);
const ttft = rows.map((r) => r.ttft_ms).filter((v) => v != null);
const total = rows.filter((r) => r.status === "ok").map((r) => r.total_ms).filter((v) => v != null);
const perDay = Object.entries(tally(rows, (r) => r.day)).sort();

section(`Summary, last ${days} day(s)`);
line("Questions", rows.length);
line("Conversations", new Set(rows.map((r) => r.session).filter(Boolean)).size);
line("Distinct visitors", new Set(rows.map((r) => r.visitor).filter(Boolean)).size);
line("Outcomes", top(status, 6));
line("Unanswered", `${sum("unanswered")} of ${rows.length}`);
line("First token ms", `p50 ${pct(ttft, 0.5)}, p95 ${pct(ttft, 0.95)}`);
line("Full answer ms", `p50 ${pct(total, 0.5)}, p95 ${pct(total, 0.95)}`);
line("Tokens in / out / think", `${sum("tokens_in")} / ${sum("tokens_out")} / ${sum("tokens_think")}`);
line("Top countries", top(tally(rows, (r) => r.country ?? "unknown")));
line("Per day", perDay.map(([d, n]) => `${d.slice(5)}:${n}`).join(" ") || "-");

const unanswered = rows.filter((r) => r.unanswered && r.question);
section(`Unanswered questions (${unanswered.length}): add these facts to profile.js`);
unanswered.slice(0, 20).forEach((r) => console.log(`  ${when(r.ts)}  ${clip(r.question)}`));
if (!unanswered.length) console.log("  none");

const bad = rows.filter((r) => ["error", "blocked", "empty"].includes(r.status));
section(`Errors (${bad.length})`);
bad.slice(0, 10).forEach((r) => console.log(`  ${when(r.ts)}  ${r.status}  ${r.error ?? ""}`));
if (!bad.length) console.log("  none");

section("Recent questions");
rows.filter((r) => r.question).slice(0, 20).forEach((r) => {
  console.log(`  ${when(r.ts)}  ${r.country ?? "--"}  Q: ${clip(r.question, 90)}`);
  console.log(`${" ".repeat(26)}A: ${clip((r.answer ?? "").replace(/\s+/g, " "), 90)}`);
});
