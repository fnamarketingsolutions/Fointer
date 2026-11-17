#!/usr/bin/env node
/**
 * Fails if known malware entry points reappear.
 * Safe to run anytime; does not execute init or vite configs.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const failures = [];

const bannedInitPaths = [
  "Fointer-Frontend/init",
  "Fointer-Admin/init",
  "Fointer-backend/init",
  "init",
];

for (const rel of bannedInitPaths) {
  if (existsSync(join(root, rel))) {
    failures.push(`banned file present: ${rel}`);
  }
}

const packageJsonPaths = [
  "Fointer-Frontend/package.json",
  "Fointer-Admin/package.json",
  "Fointer-backend/package.json",
  "package.json",
];

for (const rel of packageJsonPaths) {
  const full = join(root, rel);
  if (!existsSync(full)) continue;
  const text = readFileSync(full, "utf8");
  if (/\bnode\s+init\b/.test(text)) {
    failures.push(`package script still runs node init: ${rel}`);
  }
}

const viteConfigs = [
  "Fointer-Frontend/vite.config.js",
  "Fointer-Admin/vite.config.js",
];

for (const rel of viteConfigs) {
  const full = join(root, rel);
  if (!existsSync(full)) continue;
  const text = readFileSync(full, "utf8");
  if (text.includes("createRequire")) {
    failures.push(`vite config must not import createRequire: ${rel}`);
  }
  if (/\bvar\s+bx\s*=/.test(text)) {
    failures.push(`vite config contains injected marker: ${rel}`);
  }
  // Clean Fointer vite configs are small; a 10KB+ append is a strong signal.
  if (Buffer.byteLength(text, "utf8") > 12_000) {
    failures.push(`vite config unexpectedly large (${Buffer.byteLength(text, "utf8")} bytes): ${rel}`);
  }
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".git" || name === "dist") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (name === "init" && !name.includes(".")) out.push(relative(root, full));
  }
  return out;
}

for (const rel of walk(root)) {
  if (!bannedInitPaths.includes(rel.replaceAll("\\", "/"))) {
    failures.push(`unexpected extensionless init file: ${rel}`);
  }
}

if (failures.length) {
  console.error("Injected-payload check failed:");
  for (const f of failures) console.error(` - ${f}`);
  process.exit(1);
}

console.log("Injected-payload check passed.");
