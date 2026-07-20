import { execFile } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { relative, resolve, sep } from "node:path";

import { ROOT } from "./lib/catalog.js";
import { findPublicSafetyIssues } from "./lib/public-safety.js";

interface PackageTarget {
  readonly directory: string;
  readonly name: string;
  readonly requiredFiles: readonly string[];
  readonly manifestEntries: readonly {
    readonly path: readonly string[];
    readonly expected: string;
  }[];
}

interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
}

const PACKAGE_TARGETS: readonly PackageTarget[] = [
  {
    directory: "packages/core",
    name: "@unifyport/agent-core",
    requiredFiles: ["LICENSE", "package.json", "README.md", "README.zh-CN.md"],
    manifestEntries: [
      { path: ["exports", ".", "types"], expected: "./dist/index.d.ts" },
      { path: ["exports", ".", "import"], expected: "./dist/index.js" }
    ]
  },
  {
    directory: "packages/server",
    name: "@unifyport/agent-skills",
    requiredFiles: ["LICENSE", "package.json", "README.md", "README.zh-CN.md"],
    manifestEntries: [
      { path: ["exports", ".", "types"], expected: "./dist/index.d.ts" },
      { path: ["exports", ".", "import"], expected: "./dist/index.js" },
      { path: ["bin", "unifyport-agent"], expected: "./dist/cli.js" },
      { path: ["bin", "unifyport-mcp"], expected: "./dist/mcp-cli.js" }
    ]
  }
];

function runCommand(
  command: string,
  arguments_: readonly string[],
  cwd: string
): Promise<CommandResult> {
  return new Promise((resolvePromise, rejectPromise) => {
    execFile(
      command,
      arguments_,
      { cwd, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error !== null) {
          const detail = stderr.trim() === "" ? stdout.trim() : stderr.trim();
          rejectPromise(
            new Error(`${command} failed${detail === "" ? "" : `: ${detail}`}`, { cause: error })
          );
          return;
        }
        resolvePromise({ stdout, stderr });
      }
    );
  });
}

async function runPnpm(arguments_: readonly string[], cwd: string): Promise<CommandResult> {
  const npmExecPath = process.env["npm_execpath"];
  // 复用启动当前脚本的 pnpm，避免 PATH 中的其他版本改变打包结果。
  if (npmExecPath !== undefined && npmExecPath !== "") {
    return runCommand(process.execPath, [npmExecPath, ...arguments_], cwd);
  }
  return runCommand(process.platform === "win32" ? "pnpm.cmd" : "pnpm", arguments_, cwd);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function manifestValue(manifest: Record<string, unknown>, path: readonly string[]): unknown {
  let value: unknown = manifest;
  for (const segment of path) {
    value = requiredRecord(value, path.join("."))[segment];
  }
  return value;
}

function collectEntryPaths(value: unknown, label: string): readonly string[] {
  // library package 可以没有 bin；存在声明时才要求其目标文件完整。
  if (value === undefined) return [];
  if (typeof value === "string") return [value];
  if (value === null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => collectEntryPaths(entry, `${label}[${String(index)}]`));
  }
  if (isRecord(value)) {
    return Object.entries(value).flatMap(([key, entry]) =>
      collectEntryPaths(entry, `${label}.${key}`)
    );
  }
  throw new Error(`${label} must resolve to a package-relative path`);
}

async function requireRegularFile(packageRoot: string, file: string, label: string): Promise<void> {
  if (!file.startsWith("./") && label === "entry") {
    throw new Error(`package ${label} must start with ./: ${file}`);
  }
  const path = resolve(packageRoot, file);
  const pathFromRoot = relative(packageRoot, path);
  // 入口必须留在解包根目录，避免归档通过路径穿越引用宿主文件。
  if (pathFromRoot === ".." || pathFromRoot.startsWith(`..${sep}`) || pathFromRoot === "") {
    throw new Error(`package ${label} escapes the package root: ${file}`);
  }
  let stats;
  try {
    stats = await lstat(path);
  } catch {
    throw new Error(`package ${label} is missing: ${file}`);
  }
  if (!stats.isFile()) throw new Error(`package ${label} is not a regular file: ${file}`);
}

function validateArchiveEntries(listing: string, packageName: string): void {
  const entries = listing
    .split(/\r?\n/u)
    .map((entry) => entry.replaceAll("\\", "/").replace(/\/$/u, ""))
    .filter((entry) => entry !== "");
  if (entries.length === 0) throw new Error(`${packageName} tarball is empty`);
  for (const entry of entries) {
    const segments = entry.split("/");
    if (segments[0] !== "package" || segments.includes("..") || entry.startsWith("/")) {
      throw new Error(`${packageName} tarball has an unsafe path: ${entry}`);
    }
  }
}

function validateArchiveTypes(listing: string, packageName: string): void {
  for (const line of listing.split(/\r?\n/u)) {
    // 解包前拒绝 link，避免 link target 让后续归档条目写出临时目录。
    if (line.startsWith("l") || line.startsWith("h")) {
      throw new Error(`${packageName} tarball contains a link entry`);
    }
  }
}

async function validateManifest(packageRoot: string, target: PackageTarget): Promise<void> {
  const text = await readFile(resolve(packageRoot, "package.json"), "utf8");
  const manifest = requiredRecord(JSON.parse(text) as unknown, `${target.name} package.json`);
  if (manifest["name"] !== target.name) {
    throw new Error(`${target.name} packed manifest has an unexpected name`);
  }
  if (manifest["private"] === true) throw new Error(`${target.name} packed manifest is private`);
  if (JSON.stringify(manifest).includes("workspace:")) {
    throw new Error(`${target.name} packed manifest still contains a workspace dependency`);
  }

  for (const requirement of target.manifestEntries) {
    const value = manifestValue(manifest, requirement.path);
    if (value !== requirement.expected) {
      throw new Error(`${target.name} has an unexpected ${requirement.path.join(".")} entry`);
    }
  }

  const entryPaths = [
    ...collectEntryPaths(manifest["exports"], `${target.name}.exports`),
    ...collectEntryPaths(manifest["bin"], `${target.name}.bin`)
  ];
  for (const entryPath of new Set(entryPaths)) {
    await requireRegularFile(packageRoot, entryPath, "entry");
  }
}

async function validatePackage(target: PackageTarget, temporaryRoot: string): Promise<number> {
  const targetRoot = resolve(temporaryRoot, target.name.replaceAll("/", "-"));
  const archiveRoot = resolve(targetRoot, "archive");
  const extractedRoot = resolve(targetRoot, "extracted");
  await mkdir(archiveRoot, { recursive: true });
  await mkdir(extractedRoot, { recursive: true });

  await runPnpm(["pack", "--pack-destination", archiveRoot], resolve(ROOT, target.directory));
  const archives = (await readdir(archiveRoot)).filter((file) => file.endsWith(".tgz"));
  if (archives.length !== 1) {
    throw new Error(`${target.name} produced ${String(archives.length)} tarballs instead of one`);
  }

  const archive = resolve(archiveRoot, archives[0] ?? "");
  const listing = await runCommand("tar", ["-tzf", archive], ROOT);
  validateArchiveEntries(listing.stdout, target.name);
  const verboseListing = await runCommand("tar", ["-tvzf", archive], ROOT);
  validateArchiveTypes(verboseListing.stdout, target.name);
  await runCommand("tar", ["-xzf", archive, "-C", extractedRoot], ROOT);

  const packageRoot = resolve(extractedRoot, "package");
  const safety = await findPublicSafetyIssues(packageRoot);
  if (safety.findings.length > 0) {
    for (const finding of safety.findings) {
      process.stderr.write(`[package:check] ${target.name}/${finding.file}: ${finding.rule}\n`);
    }
    throw new Error(`${target.name} public package validation found safety issues`);
  }

  for (const file of target.requiredFiles) {
    await requireRegularFile(packageRoot, file, "required file");
  }
  await validateManifest(packageRoot, target);
  return safety.filesChecked;
}

const temporaryRoot = await mkdtemp(resolve(tmpdir(), "unifyport-agent-packages-"));
try {
  for (const target of PACKAGE_TARGETS) {
    const filesChecked = await validatePackage(target, temporaryRoot);
    process.stderr.write(`[package:check] ${target.name} checked ${String(filesChecked)} files\n`);
  }
  process.stderr.write(`[package:check] checked ${String(PACKAGE_TARGETS.length)} packages\n`);
} finally {
  // 打包产物只用于本次校验，始终删除以免把审计中间件误带入仓库或后续发布。
  await rm(temporaryRoot, { recursive: true, force: true });
}
