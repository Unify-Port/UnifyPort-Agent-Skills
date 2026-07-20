import { findPublicSafetyIssues } from "./lib/public-safety.js";
import { ROOT } from "./lib/catalog.js";

const result = await findPublicSafetyIssues(ROOT);
if (result.findings.length > 0) {
  for (const finding of result.findings) {
    process.stderr.write(`[public:check] ${finding.file}: ${finding.rule}\n`);
  }
  throw new Error(`public boundary validation found ${String(result.findings.length)} issue(s)`);
}

process.stderr.write(`[public:check] checked ${String(result.filesChecked)} files\n`);
