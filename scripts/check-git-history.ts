import { execFileSync } from "node:child_process";

import { ROOT } from "./lib/catalog.js";
import { scanText } from "./lib/public-safety.js";

const MAX_HISTORY_BYTES = 128 * 1024 * 1024;
const commits = execFileSync("git", ["rev-list", "--all"], {
  cwd: ROOT,
  encoding: "utf8",
  maxBuffer: MAX_HISTORY_BYTES
}).trim();

if (commits === "") {
  process.stderr.write("[history:check] no commits to scan\n");
} else {
  // 扫描完整 patch 可覆盖已删除内容，避免敏感资料只从当前工作树移除却仍留在公开历史中。
  const history = execFileSync(
    "git",
    ["log", "--all", "--format=fuller", "--patch", "--no-ext-diff", "--text"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: MAX_HISTORY_BYTES }
  );
  const findings = scanText(history, "<git-history>");
  if (findings.length > 0) {
    for (const finding of findings) {
      process.stderr.write(`[history:check] ${finding.file}: ${finding.rule}\n`);
    }
    throw new Error(`git history validation found ${String(findings.length)} issue(s)`);
  }
  process.stderr.write(`[history:check] checked ${String(commits.split("\n").length)} commit(s)\n`);
}
