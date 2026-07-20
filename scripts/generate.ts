import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { ROOT } from "./lib/catalog.js";
import { buildGeneratedArtifacts } from "./lib/generator.js";

const artifacts = await buildGeneratedArtifacts();
for (const artifact of artifacts) {
  const path = resolve(ROOT, artifact.path);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, artifact.content, "utf8");
}

process.stderr.write(`[generate] wrote ${String(artifacts.length)} artifacts\n`);
