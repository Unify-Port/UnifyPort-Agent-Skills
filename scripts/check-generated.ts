import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { ROOT } from "./lib/catalog.js";
import { buildGeneratedArtifacts } from "./lib/generator.js";

const failures: string[] = [];
const artifacts = await buildGeneratedArtifacts();
for (const artifact of artifacts) {
  let actual: string;
  try {
    actual = await readFile(resolve(ROOT, artifact.path), "utf8");
  } catch {
    failures.push(`${artifact.path}: missing`);
    continue;
  }
  if (actual !== artifact.content) failures.push(`${artifact.path}: stale`);
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`[generate:check] ${failure}\n`);
  throw new Error("generated files are not current; run pnpm generate");
}

process.stderr.write(`[generate:check] checked ${String(artifacts.length)} artifacts\n`);
