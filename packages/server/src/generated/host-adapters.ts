/**
 * 此文件由 adapters/hosts.yaml 生成；修改来源后运行 pnpm generate。
 */
export type HostInstallMode = "directory" | "cli" | "manual_import" | "remote_integration";

export interface HostAdapter {
  readonly kind: string;
  readonly installMode: HostInstallMode;
  readonly projectDirectory?: string;
  readonly userDirectory?: string;
  readonly command?: string;
  readonly note?: string;
  readonly integration?: string;
}

export const hostAdapters = {
  codex: {
    kind: "agent_skills",
    installMode: "directory",
    projectDirectory: ".agents/skills",
    userDirectory: ".codex/skills"
  },
  "claude-code": {
    kind: "agent_skills",
    installMode: "directory",
    projectDirectory: ".claude/skills",
    userDirectory: ".claude/skills"
  },
  cursor: {
    kind: "agent_skills",
    installMode: "directory",
    projectDirectory: ".cursor/skills",
    userDirectory: ".cursor/skills"
  },
  "gemini-cli": {
    kind: "agent_skills",
    installMode: "directory",
    projectDirectory: ".gemini/skills",
    userDirectory: ".gemini/skills"
  },
  "github-copilot": {
    kind: "agent_skills",
    installMode: "directory",
    projectDirectory: ".github/skills",
    userDirectory: ".copilot/skills"
  },
  "kimi-code": {
    kind: "agent_skills",
    installMode: "directory",
    projectDirectory: ".kimi-code/skills",
    userDirectory: ".kimi-code/skills"
  },
  "qwen-code": {
    kind: "agent_skills",
    installMode: "directory",
    projectDirectory: ".qwen/skills",
    userDirectory: ".qwen/skills"
  },
  qoder: {
    kind: "agent_skills",
    installMode: "directory",
    projectDirectory: ".qoder/skills",
    userDirectory: ".qoder/skills"
  },
  trae: {
    kind: "manual_import",
    installMode: "manual_import",
    note: "Import the canonical Skill directories through the TRAE user interface."
  },
  openclaw: {
    kind: "agent_skills",
    installMode: "cli",
    command: "openclaw skills install <skill-directory>"
  },
  dify: {
    kind: "platform_adapter",
    installMode: "remote_integration",
    integration: "dify_mcp_provider"
  },
  coze: {
    kind: "platform_adapter",
    installMode: "remote_integration",
    integration: "coze_openapi"
  }
} as const satisfies Readonly<Record<string, HostAdapter>>;

// 动态 CLI 参数通过宽类型 registry 查询，保留 hostAdapters 的字面量类型供调用方检查。
export const hostAdapterRegistry: Readonly<Record<string, HostAdapter>> = hostAdapters;
