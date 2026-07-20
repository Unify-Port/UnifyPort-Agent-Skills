import { rm } from "node:fs/promises";
import { resolve } from "node:path";

import { ROOT } from "./lib/catalog.js";

// 只清理可重复生成的构建目录，避免误删 canonical Skills 或安全策略来源。
for (const directory of [
  "coverage",
  "dist",
  "packages/core/dist",
  "packages/server/dist"
] as const) {
  await rm(resolve(ROOT, directory), { force: true, recursive: true });
}
