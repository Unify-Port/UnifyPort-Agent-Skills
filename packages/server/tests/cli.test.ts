import { execFile } from "node:child_process";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { promisify } from "node:util";

import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);

describe("secure CLI diagnostics", () => {
  it("does not echo a rejected local path or environment content", async () => {
    // 子进程边界覆盖真实 stderr，防止单元测试 mock 掩盖路径或凭证回显。
    const privatePath = "private-input-name-that-must-not-be-echoed.json";
    const environment = {
      PATH: process.env["PATH"],
      NODE_PATH: process.env["NODE_PATH"],
      UNIFYPORT_API_KEY: "<api-key>"
    };
    try {
      await execFileAsync(
        process.execPath,
        [
          "--import",
          "tsx",
          "packages/server/src/cli.ts",
          "call",
          "getWorkspace",
          "--input-file",
          privatePath
        ],
        { cwd: process.cwd(), env: environment }
      );
      throw new Error("Expected the CLI to fail");
    } catch (error) {
      const result = error as { readonly stdout?: string; readonly stderr?: string };
      expect(result.stdout ?? "").toBe("");
      expect(result.stderr ?? "").toContain("code=INVALID_INPUT_FILE");
      expect(result.stderr ?? "").not.toContain(privatePath);
      expect(result.stderr ?? "").not.toContain("<api-key>");
    }
  });

  it("rejects a symlinked request file before runtime invocation", async () => {
    const directory = await mkdtemp(resolve(tmpdir(), "unifyport-cli-input-"));
    const target = resolve(directory, "request.json");
    const link = resolve(directory, "request-link.json");
    try {
      await writeFile(target, "{}\n", "utf8");
      await symlink(target, link, "file");
      await execFileAsync(
        process.execPath,
        [
          "--import",
          "tsx",
          "packages/server/src/cli.ts",
          "call",
          "getWorkspace",
          "--input-file",
          link
        ],
        {
          cwd: process.cwd(),
          env: { PATH: process.env["PATH"], UNIFYPORT_API_KEY: "<api-key>" }
        }
      );
      throw new Error("Expected the CLI to reject a symlink");
    } catch (error) {
      const result = error as { readonly stdout?: string; readonly stderr?: string };
      expect(result.stdout ?? "").toBe("");
      expect(result.stderr ?? "").toContain("code=INVALID_INPUT_FILE");
      expect(result.stderr ?? "").not.toContain(directory);
    } finally {
      // 测试只删除自己创建的唯一临时目录，避免清理越界。
      await rm(directory, { recursive: true, force: true });
    }
  });
});
