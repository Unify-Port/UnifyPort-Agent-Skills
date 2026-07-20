import { access, readFile, readdir } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";

import { ROOT } from "./lib/catalog.js";

const IGNORED_DIRECTORIES = new Set([".git", "coverage", "dist", "node_modules"]);
const MARKDOWN_LINK = /!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+["'][^"']*["'])?\)/gu;

async function collectMarkdown(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collectMarkdown(path)));
    else if (entry.isFile() && entry.name.endsWith(".md")) files.push(path);
  }
  return files;
}

function display(path: string): string {
  return relative(ROOT, path).replaceAll("\\", "/");
}

function counterpart(path: string): string {
  if (path.endsWith(".zh-CN.md")) return path.replace(/\.zh-CN\.md$/u, ".md");
  return path.replace(/\.md$/u, ".zh-CN.md");
}

function localLink(source: string, rawTarget: string): string | undefined {
  const target = rawTarget.replace(/^<|>$/gu, "");
  if (/^(?:https?:|mailto:)/u.test(target)) return undefined;
  const path = target.split("#", 1)[0]?.split("?", 1)[0] ?? "";
  return path === "" ? source : resolve(dirname(source), decodeURIComponent(path));
}

const files = await collectMarkdown(ROOT);
const fileSet = new Set(files);
const failures: string[] = [];
let checkedLinks = 0;

for (const file of files) {
  const path = display(file);
  const content = await readFile(file, "utf8");
  const pair = counterpart(file);
  if (!fileSet.has(pair)) failures.push(`${path}: missing bilingual counterpart ${display(pair)}`);
  if (!content.includes("[English]") || !content.includes("[简体中文]")) {
    failures.push(`${path}: missing language navigation`);
  }
  const isChinese = file.endsWith(".zh-CN.md");
  const withoutNavigation = content.replaceAll("简体中文", "");
  if (!isChinese && /[\p{Script=Han}]/u.test(withoutNavigation)) {
    failures.push(`${path}: English document contains Chinese body text`);
  }
  if (isChinese && !/[\p{Script=Han}]/u.test(content)) {
    failures.push(`${path}: Chinese document contains no Chinese body text`);
  }
  for (const match of content.matchAll(MARKDOWN_LINK)) {
    const rawTarget = match[1];
    if (rawTarget === undefined) continue;
    const target = localLink(file, rawTarget);
    if (target === undefined) continue;
    checkedLinks += 1;
    if (relative(ROOT, target).startsWith("..")) {
      failures.push(`${path}: local link leaves repository: ${rawTarget}`);
      continue;
    }
    try {
      await access(target);
    } catch {
      failures.push(`${path}: local link target does not exist: ${rawTarget}`);
    }
  }

  if (path.endsWith("/SKILL.md") || path === "SKILL.md") {
    if (!content.startsWith("---\n") || !/^name: unifyport-[a-z0-9-]+$/mu.test(content)) {
      failures.push(`${path}: invalid Agent Skills frontmatter name`);
    }
    if (!/^description: .+$/mu.test(content)) failures.push(`${path}: missing Skill description`);
  }
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`[docs:check] ${failure}\n`);
  throw new Error(`documentation validation found ${String(failures.length)} issue(s)`);
}

process.stderr.write(
  `[docs:check] checked ${String(files.length)} bilingual Markdown files and ${String(checkedLinks)} local links\n`
);
