import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readJson = async (name) => JSON.parse(await readFile(resolve(root, name), "utf8"));

test("package, lockfile, and displayed CLI versions stay aligned", async () => {
  const pkg = await readJson("package.json");
  const lock = await readJson("package-lock.json");
  const profile = await readFile(resolve(root, "src/profile.js"), "utf8");
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[""].version, pkg.version);
  assert.ok(profile.includes(`version: "${pkg.version}"`));
});

test("published executable points to a packaged Node CLI", async () => {
  const pkg = await readJson("package.json");
  const entry = typeof pkg.bin === "string" ? pkg.bin : pkg.bin["melwin-portfolio"];
  assert.ok(entry, "package must declare the melwin-portfolio executable");
  const file = await readFile(resolve(root, entry), "utf8");
  assert.ok(file.startsWith("#!/usr/bin/env node"), "CLI entry must have a Node shebang");
  assert.ok(pkg.files.includes("src"), "the CLI source directory must be included in the npm package");
});
