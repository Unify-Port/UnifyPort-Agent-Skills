import { chmod, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { hostAdapters, installCanonicalSkills } from "../src/installer.js";
import { canonicalSkillAssets } from "../src/generated/skill-assets.js";

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(resolve(tmpdir(), "unifyport-skills-"));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  // 测试目录逐项登记，避免误删工作区或其他临时数据。
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("host adapters", () => {
  it("uses verified native project directories", () => {
    expect(
      Object.fromEntries(
        Object.entries(hostAdapters)
          .filter(
            ([, adapter]) => adapter.installMode === "directory" && "projectDirectory" in adapter
          )
          .map(([host, adapter]) => [
            host,
            "projectDirectory" in adapter ? adapter.projectDirectory : undefined
          ])
      )
    ).toEqual({
      codex: ".agents/skills",
      "claude-code": ".claude/skills",
      cursor: ".cursor/skills",
      "gemini-cli": ".gemini/skills",
      "github-copilot": ".github/skills",
      "kimi-code": ".kimi-code/skills",
      "qwen-code": ".qwen/skills",
      qoder: ".qoder/skills"
    });
    expect(hostAdapters.codex.userDirectory).toBe(".codex/skills");
  });

  it("does not present import and platform targets as native directories", () => {
    expect(hostAdapters.trae.installMode).toBe("manual_import");
    expect(hostAdapters.openclaw.installMode).toBe("cli");
    expect(hostAdapters.openclaw.command).toBe("openclaw skills install <skill-directory>");
    expect(hostAdapters.dify).toMatchObject({
      kind: "platform_adapter",
      installMode: "remote_integration"
    });
    expect(hostAdapters.coze).toMatchObject({
      kind: "platform_adapter",
      installMode: "remote_integration"
    });
  });
});

describe("installCanonicalSkills", () => {
  it("installs all 16 canonical Skill directories and skips identical files", async () => {
    const root = await temporaryDirectory();
    const first = await installCanonicalSkills({ host: "codex", rootDirectory: root });
    expect(first).toMatchObject({
      installDirectory: ".agents/skills",
      skills: 16,
      installedFiles: 64,
      skippedFiles: 0
    });
    expect(JSON.stringify(first)).not.toContain(root);

    for (const [skillName, assets] of Object.entries(canonicalSkillAssets)) {
      for (const [assetPath, content] of Object.entries(assets)) {
        expect(await readFile(resolve(root, ".agents/skills", skillName, assetPath), "utf8")).toBe(
          content
        );
      }
    }

    const second = await installCanonicalSkills({ host: "codex", rootDirectory: root });
    expect(second).toMatchObject({ skills: 16, installedFiles: 0, skippedFiles: 64 });
  });

  it("refuses conflicts by default and overwrites only with explicit opt-in", async () => {
    const root = await temporaryDirectory();
    await installCanonicalSkills({ host: "claude", rootDirectory: root });
    const skillFile = resolve(root, ".claude/skills/workspace-overview/SKILL.md");
    await writeFile(skillFile, "local change\n", "utf8");

    await expect(
      installCanonicalSkills({ host: "claude-code", rootDirectory: root })
    ).rejects.toThrow("INSTALL_CONFLICT");
    const result = await installCanonicalSkills({
      host: "claude-code",
      rootDirectory: root,
      overwrite: true
    });
    expect(result.overwrittenFiles).toBe(1);
    expect(await readFile(skillFile, "utf8")).toBe(
      canonicalSkillAssets["workspace-overview"]["SKILL.md"]
    );
  });

  it("rejects destination symlinks", async () => {
    const root = await temporaryDirectory();
    const outside = await temporaryDirectory();
    await mkdir(resolve(root, ".agents"), { recursive: true });
    await symlink(outside, resolve(root, ".agents/skills"), "dir");

    await expect(installCanonicalSkills({ host: "codex", rootDirectory: root })).rejects.toThrow(
      "SYMLINK_DESTINATION_REJECTED"
    );
  });

  it("rejects a shared-writable POSIX install root", async () => {
    if (typeof process.geteuid !== "function" || process.geteuid() === 0) return;
    const root = await temporaryDirectory();
    // 共享可写 root 会让其他本机用户参与目录竞态，必须在写入任何资产前拒绝。
    await chmod(root, 0o777);
    try {
      await expect(installCanonicalSkills({ host: "codex", rootDirectory: root })).rejects.toThrow(
        "UNSAFE_INSTALL_PERMISSIONS"
      );
    } finally {
      await chmod(root, 0o700);
    }
  });

  it("rejects traversal in packaged asset paths before writing", async () => {
    const root = await temporaryDirectory();
    const mutableAssets = canonicalSkillAssets as unknown as Record<string, Record<string, string>>;
    // 运行时仍需防御被篡改的包资产，不能只依赖 TypeScript readonly。
    mutableAssets["../escaped"] = { "SKILL.md": "unsafe" };
    try {
      await expect(installCanonicalSkills({ host: "codex", rootDirectory: root })).rejects.toThrow(
        "UNSAFE_SKILL_NAME"
      );
      await expect(readFile(resolve(root, "escaped/SKILL.md"), "utf8")).rejects.toThrow();
    } finally {
      delete mutableAssets["../escaped"];
    }
  });

  it.each(["trae", "openclaw", "dify", "coze"])("refuses non-directory host %s", async (host) => {
    await expect(
      installCanonicalSkills({ host, rootDirectory: await temporaryDirectory() })
    ).rejects.toThrow(/^HOST_INSTALL_MODE_/u);
  });
});
