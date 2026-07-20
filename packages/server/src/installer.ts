import { randomUUID } from "node:crypto";
import type { Stats } from "node:fs";
import { homedir } from "node:os";
import { lstat, mkdir, open, readFile, readdir, realpath, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute, parse, relative, resolve, sep } from "node:path";

import { hostAdapterRegistry, type HostAdapter } from "./generated/host-adapters.js";
import { canonicalSkillAssets } from "./generated/skill-assets.js";

export type InstallScope = "project" | "user";

export interface InstallSkillsOptions {
  readonly host: string;
  readonly scope?: InstallScope;
  readonly rootDirectory?: string;
  readonly overwrite?: boolean;
}

export interface InstallSkillsResult {
  readonly host: string;
  readonly scope: InstallScope;
  readonly installDirectory: string;
  readonly skills: number;
  readonly installedFiles: number;
  readonly skippedFiles: number;
  readonly overwrittenFiles: number;
}

const HOST_ALIASES: Readonly<Record<string, string>> = {
  claude: "claude-code",
  copilot: "github-copilot",
  gemini: "gemini-cli",
  github: "github-copilot",
  kimi: "kimi-code",
  qwen: "qwen-code"
};

const POSIX_GROUP_OR_WORLD_WRITE = 0o022;
const POSIX_STICKY = 0o1000;

function canonicalHost(host: string): string {
  const normalized = host.trim().toLowerCase();
  return HOST_ALIASES[normalized] ?? normalized;
}

function directoryAdapter(host: string): HostAdapter & {
  readonly installMode: "directory";
  readonly projectDirectory: string;
  readonly userDirectory: string;
} {
  const adapter = hostAdapterRegistry[host];
  if (adapter === undefined) throw new Error("UNKNOWN_INSTALL_HOST");
  if (adapter.installMode !== "directory") {
    // 非目录型 host 必须走各自受支持的导入入口，不能伪装成本地原生安装。
    throw new Error(`HOST_INSTALL_MODE_${adapter.installMode.toUpperCase()}`);
  }
  if (adapter.projectDirectory === undefined || adapter.userDirectory === undefined) {
    throw new Error("INVALID_HOST_ADAPTER");
  }
  return {
    ...adapter,
    installMode: "directory",
    projectDirectory: adapter.projectDirectory,
    userDirectory: adapter.userDirectory
  };
}

function safeRelativePath(path: string, label: string): string {
  if (path === "" || isAbsolute(path)) throw new Error(`UNSAFE_${label}`);
  const segments = path.split(/[\\/]/u);
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`UNSAFE_${label}`);
  }
  return segments.join(sep);
}

function containedPath(root: string, path: string, label: string): string {
  const target = resolve(root, safeRelativePath(path, label));
  const fromRoot = relative(root, target);
  if (
    fromRoot === "" ||
    fromRoot === ".." ||
    fromRoot.startsWith(`..${sep}`) ||
    isAbsolute(fromRoot)
  ) {
    throw new Error(`UNSAFE_${label}`);
  }
  return target;
}

async function optionalStat(path: string): Promise<Stats | undefined> {
  try {
    return await lstat(path);
  } catch (error: unknown) {
    if (error !== null && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

function effectiveUserId(): number | undefined {
  return typeof process.geteuid === "function" ? process.geteuid() : undefined;
}

function assertUnprivilegedProcess(): void {
  const effective = effectiveUserId();
  const real = typeof process.getuid === "function" ? process.getuid() : undefined;
  // 标准 Node fs 缺少跨平台 openat；拒绝提权运行可避免把本地 installer 变成权限跨越边界。
  if (effective === 0 || (effective !== undefined && real !== undefined && effective !== real)) {
    throw new Error("ELEVATED_INSTALL_REJECTED");
  }
}

function assertDirectoryTrust(stats: Stats, requireCurrentOwner: boolean): void {
  const effective = effectiveUserId();
  if (effective === undefined) return;
  const trustedOwner = stats.uid === effective || (!requireCurrentOwner && stats.uid === 0);
  if (!trustedOwner) {
    // 路径祖先只能由当前用户或系统 root 控制，不能穿过其他本机用户拥有的目录。
    throw new Error("UNTRUSTED_INSTALL_OWNER");
  }
  const sharedWritable = (stats.mode & POSIX_GROUP_OR_WORLD_WRITE) !== 0;
  const stickyAncestor = !requireCurrentOwner && (stats.mode & POSIX_STICKY) !== 0;
  if (sharedWritable && !stickyAncestor) throw new Error("UNSAFE_INSTALL_PERMISSIONS");
}

async function trustedRoot(requestedRoot: string): Promise<string> {
  assertUnprivilegedProcess();
  const requested = resolve(requestedRoot);
  const requestedStat = await optionalStat(requested);
  if (requestedStat?.isSymbolicLink() === true) throw new Error("SYMLINK_DESTINATION_REJECTED");
  if (requestedStat?.isDirectory() !== true) {
    throw new Error("INVALID_INSTALL_ROOT");
  }
  const canonical = await realpath(requested);
  const filesystemRoot = parse(canonical).root;
  let current = filesystemRoot;
  for (const segment of relative(filesystemRoot, canonical).split(sep).filter(Boolean)) {
    current = resolve(current, segment);
    const stats = await lstat(current);
    if (stats.isSymbolicLink()) throw new Error("SYMLINK_DESTINATION_REJECTED");
    if (!stats.isDirectory()) throw new Error("INVALID_INSTALL_ROOT");
    // Sticky shared ancestors（例如系统临时目录）可接受；安装根本身仍必须由当前用户独占。
    assertDirectoryTrust(stats, current === canonical);
  }
  if (canonical === filesystemRoot) assertDirectoryTrust(await lstat(canonical), true);
  return canonical;
}

async function assertDirectoryChain(root: string, relativeDirectory: string): Promise<void> {
  const rootStat = await optionalStat(root);
  if (rootStat?.isSymbolicLink() === true) throw new Error("SYMLINK_DESTINATION_REJECTED");
  if (rootStat !== undefined && !rootStat.isDirectory()) throw new Error("INVALID_INSTALL_ROOT");
  if (rootStat !== undefined) assertDirectoryTrust(rootStat, true);

  let current = root;
  for (const segment of safeRelativePath(relativeDirectory, "DIRECTORY").split(sep)) {
    current = resolve(current, segment);
    const currentStat = await optionalStat(current);
    if (currentStat?.isSymbolicLink() === true) throw new Error("SYMLINK_DESTINATION_REJECTED");
    if (currentStat !== undefined && !currentStat.isDirectory()) {
      throw new Error("INVALID_INSTALL_DIRECTORY");
    }
    if (currentStat !== undefined) assertDirectoryTrust(currentStat, true);
  }
}

async function assertNoNestedSymlink(directory: string): Promise<void> {
  const directoryStat = await optionalStat(directory);
  if (directoryStat === undefined) return;
  if (directoryStat.isSymbolicLink()) throw new Error("SYMLINK_DESTINATION_REJECTED");
  if (!directoryStat.isDirectory()) throw new Error("INVALID_SKILL_DIRECTORY");
  assertDirectoryTrust(directoryStat, true);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error("SYMLINK_DESTINATION_REJECTED");
    if (entry.isDirectory()) await assertNoNestedSymlink(path);
  }
}

interface PlannedFile {
  readonly path: string;
  readonly content: string;
  readonly action: "create" | "skip" | "overwrite";
  readonly previousContent?: string;
  readonly fileMode?: number;
}

async function writeNewFile(path: string, content: string, mode = 0o644): Promise<void> {
  const handle = await open(path, "wx", mode);
  let complete = false;
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
    complete = true;
  } finally {
    await handle.close().catch(() => undefined);
    if (!complete) await unlink(path).catch(() => undefined);
  }
}

async function writePlannedFile(file: PlannedFile): Promise<void> {
  if (file.action === "skip") throw new Error("INVALID_INSTALL_PLAN");
  if (file.action === "create") {
    // wx 会在竞态中新建目标出现时拒绝覆盖，保持默认 no-overwrite 语义。
    await writeNewFile(file.path, file.content);
    return;
  }
  const temporaryPath = `${file.path}.unifyport-${randomUUID()}.tmp`;
  try {
    await writeNewFile(temporaryPath, file.content, file.fileMode);
    // 同目录 rename 替换目录项而不跟随目标 symlink，避免 force 模式写入链接目标。
    await rename(temporaryPath, file.path);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

async function rollbackFiles(files: readonly PlannedFile[]): Promise<void> {
  let failed = false;
  for (const file of [...files].reverse()) {
    try {
      if (file.action === "create") {
        await unlink(file.path);
      } else if (file.action === "overwrite" && file.previousContent !== undefined) {
        await writePlannedFile({
          path: file.path,
          content: file.previousContent,
          action: "overwrite",
          ...(file.fileMode === undefined ? {} : { fileMode: file.fileMode })
        });
      }
    } catch {
      // 继续尝试恢复其余文件，最终用稳定错误阻止调用方误判为完整安装。
      failed = true;
    }
  }
  if (failed) throw new Error("INSTALL_ROLLBACK_FAILED");
}

async function planFiles(destination: string, overwrite: boolean): Promise<readonly PlannedFile[]> {
  const planned: PlannedFile[] = [];
  for (const [skillName, files] of Object.entries(canonicalSkillAssets)) {
    const safeSkillName = safeRelativePath(skillName, "SKILL_NAME");
    const skillDirectory = containedPath(destination, safeSkillName, "SKILL_NAME");
    await assertNoNestedSymlink(skillDirectory);
    for (const [assetPath, content] of Object.entries(files)) {
      const path = containedPath(skillDirectory, assetPath, "ASSET_PATH");
      const targetStat = await optionalStat(path);
      if (targetStat?.isSymbolicLink() === true) throw new Error("SYMLINK_DESTINATION_REJECTED");
      if (targetStat === undefined) {
        planned.push({ path, content, action: "create" });
      } else if (!targetStat.isFile()) {
        throw new Error("INVALID_INSTALL_FILE");
      } else {
        const previousContent = await readFile(path, "utf8");
        if (previousContent === content) {
          planned.push({ path, content, action: "skip" });
        } else if (overwrite) {
          // 覆盖和失败回滚都保留既有 permission bits，避免安装器意外扩大本地读取权限。
          planned.push({
            path,
            content,
            action: "overwrite",
            previousContent,
            fileMode: targetStat.mode & 0o777
          });
        } else {
          // 全量预检可避免发生冲突时只安装一半 Skill。
          throw new Error("INSTALL_CONFLICT");
        }
      }
    }
  }
  return planned;
}

export async function installCanonicalSkills(
  options: InstallSkillsOptions
): Promise<InstallSkillsResult> {
  const host = canonicalHost(options.host);
  const scope = options.scope ?? "project";
  const adapter = directoryAdapter(host);
  const root = await trustedRoot(
    options.rootDirectory ?? (scope === "user" ? homedir() : process.cwd())
  );
  const relativeDirectory = scope === "user" ? adapter.userDirectory : adapter.projectDirectory;
  await assertDirectoryChain(root, relativeDirectory);
  const destination = containedPath(root, relativeDirectory, "DIRECTORY");
  const planned = await planFiles(destination, options.overwrite ?? false);

  await mkdir(destination, { recursive: true, mode: 0o700 });
  await assertDirectoryChain(root, relativeDirectory);
  const committed: PlannedFile[] = [];
  try {
    for (const file of planned) {
      if (file.action === "skip") continue;
      const parent = dirname(file.path);
      await mkdir(parent, { recursive: true, mode: 0o700 });
      await assertDirectoryChain(root, relativeDirectory);
      await assertNoNestedSymlink(parent);
      await writePlannedFile(file);
      committed.push(file);
    }
  } catch (error: unknown) {
    // 逆序恢复本轮已提交文件，使普通 I/O failure 不留下新旧版本混合状态。
    try {
      await rollbackFiles(committed);
    } catch {
      throw new Error("INSTALL_ROLLBACK_FAILED", { cause: error });
    }
    throw error;
  }

  return {
    host,
    scope,
    // CLI 只返回经过评审的相对目录，避免把用户名或本机绝对路径带入 agent transcript。
    installDirectory: relativeDirectory.replaceAll(sep, "/"),
    skills: Object.keys(canonicalSkillAssets).length,
    installedFiles: planned.filter((file) => file.action === "create").length,
    skippedFiles: planned.filter((file) => file.action === "skip").length,
    overwrittenFiles: planned.filter((file) => file.action === "overwrite").length
  };
}

export { hostAdapters } from "./generated/host-adapters.js";
