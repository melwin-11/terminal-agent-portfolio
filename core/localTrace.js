import { appendFileSync, mkdirSync } from "node:fs";
import { randomUUID } from "node:crypto";

const dir = new URL("../.traces/", import.meta.url);

export function writeLocalTrace(trace) {
  try {
    mkdirSync(dir, { recursive: true });
    appendFileSync(new URL("traces.jsonl", dir), `${JSON.stringify({ id: randomUUID(), ...trace })}\n`);
  } catch {
    return;
  }
}
