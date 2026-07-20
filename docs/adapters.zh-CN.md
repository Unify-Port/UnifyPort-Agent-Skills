# Adapter 支持

[English](adapters.md) | [简体中文](adapters.zh-CN.md)

## 状态与支持等级

Adapter source 和本地测试已在本仓库实现，但 npm package 尚未发布。下表的支持等级描述源码已经实现的交付方式；不代表可以从 npm 安装，也不代表已经在厂商托管环境完成端到端验证。

所有 adapters 都消费 `skills/` 下的 canonical assets。它们不会扩大 MCP allowlist、把 secrets 移入模型上下文，也不会取代处理 secure-channel operations 的受控 CLI。

| Host 或 platform | 支持等级                    | 交付方式                                                |
| ---------------- | --------------------------- | ------------------------------------------------------- |
| Codex            | 原生目录 installer          | Project `.agents/skills` 或 user `.codex/skills` 目录   |
| Claude Code      | 原生目录 installer          | Project 或 user `.claude/skills` 目录                   |
| Cursor           | 原生目录 installer          | Project 或 user `.cursor/skills` 目录                   |
| Gemini CLI       | 原生目录 installer          | Project 或 user `.gemini/skills` 目录                   |
| GitHub Copilot   | 原生目录 installer          | Project `.github/skills` 或 user `.copilot/skills` 目录 |
| Kimi Code        | 原生目录 installer          | Project 或 user `.kimi-code/skills` 目录                |
| Qwen Code        | 原生目录 installer          | Project 或 user `.qwen/skills` 目录                     |
| Qoder            | 原生目录 installer          | Project 或 user `.qoder/skills` 目录                    |
| OpenClaw         | CLI staging 与 instructions | 使用 OpenClaw CLI 安装每个 canonical Skill              |
| TRAE             | 手工导入                    | 通过 TRAE 用户界面导入 canonical Skill 内容             |
| Dify             | Platform integration recipe | 为 `/mcp` 配置 Streamable HTTP MCP provider             |
| Coze             | Platform integration recipe | 将 `/openapi.json` 导入为 custom OpenAPI plugin         |

Dify 和 Coze 是 platform integrations，不是原生 Agent Skills。TRAE 是手工导入，不是目录 installer。OpenClaw 使用自身 CLI lifecycle，不通过本仓库的目录 installer。

## 目录 installers

从源码完成构建后，将全部 16 个 canonical Skills 安装到受支持 host 目录：

```bash
unifyport-agent install --host codex --scope project
```

可以把 `codex` 替换为 `claude-code`、`cursor`、`gemini-cli`、`github-copilot`、`kimi-code`、`qwen-code` 或 `qoder`。只有明确需要 user-level 安装时才使用 `--scope user`。

Installer 只解析经过评审的相对目标目录，拒绝 symbolic-link destination，在写入前检查全部文件，并且只有显式传入 `--force` 才覆盖冲突。在 POSIX 上，它还会拒绝 root/提权运行、拒绝不属于当前 effective user 的安装根目录，以及 group/world-writable 安装目录；新建目录使用 `0700`。它只能在当前 OS user 独占控制的目录运行，禁止使用 `sudo`，也禁止放在攻击者可写的共享目录树中。标准跨平台 Node.js filesystem API 无法把每次写入都锚定到 directory handle，因此可信单用户目录属于 installer threat model 的一部分。

每个文件采用原子写入，预检全部已知冲突；multi-file write 失败时，会尽力按逆序恢复本轮已经提交的文件。灾难性 filesystem 或 rollback failure 会返回 `INSTALL_ROLLBACK_FAILED`，此时必须先检查目标目录再复跑；普通复跑会安全跳过相同文件。Installer 写入 canonical assets 的生成副本；应修改 `skills/` 并重新生成，不能把安装或生成副本当作 source of truth。

## OpenClaw CLI

OpenClaw 每条安装命令接收一个 Skill 目录。从经过评审的源码 checkout 中，使用 [OpenClaw Skills CLI](https://docs.openclaw.ai/cli/skills) 逐个安装：

```bash
openclaw skills install <skill-directory>
```

安装前评审 staged Skill，并使用 OpenClaw 自身的 scope、trust 和 update controls。本仓库提供 canonical Skill 内容和 instructions；它不会替代 OpenClaw installer，也不声称 Skills 已针对所有 OpenClaw deployments 完成验证。

## TRAE 手工导入

TRAE 被明确标记为 `manual_import`。先评审一个 canonical Skill 目录，再通过 TRAE 用户界面导入其 `SKILL.md` 和必需 reference files。不要把复制到 `.trae/skills` 的内容视为受支持原生安装，也不要把凭证粘贴到导入的 instructions。

## Dify 与 Coze

Dify 和 Coze 消费 platform-specific integration recipes，而不是 Agent Skill 目录：

- Dify 作为 MCP provider 直接连接带鉴权的 Streamable HTTP MCP endpoint。
- Coze 将 `GET /openapi.json` 导入为 custom OpenAPI plugin，并调用投影后的 `POST /tools/<tool-name>` routes。

只有应用[远程 gateway 控制](../README.zh-CN.md#远程-gateway-边界)后才能部署 gateway。Bearer API Key 必须存入平台受保护 credential facility，并在每个 MCP 或 tool-execution request 中提供。两种 integration 都只暴露 policy-gated registry：默认集合是 `getWorkspace`、`listApiKeys` 和 `listProviderRegions`；`UNIFYPORT_ALLOW_WRITES=true` 只会再增加 `updateApiKeyStatus`。OpenAPI facade 不是包含 64 个 operations 的原始 API，其余能力仍保留在受控 CLI/Skills surface。

Browser CORS 未启用。`UNIFYPORT_GATEWAY_ALLOWED_ORIGINS` 只拒绝包含未批准 `Origin` header 的请求；gateway 不返回 CORS response headers。

这些 recipes 描述受支持边界，但不代表已经在厂商 marketplace 发布、不代表原生 Agent Skill 支持，也不代表已经完成厂商托管环境端到端认证。

## 验证

分发 adapter output 前执行：

```bash
pnpm generate:check
pnpm docs:check
pnpm public:check
pnpm history:check
pnpm test
pnpm typecheck
pnpm package:check
```

最终使用 `pnpm check` 作为聚合 gate。`history:check` 扫描完整 patch history，`package:check` 会 build、pack、unpack 并扫描两个 npm tarballs，详见[维护指南](maintenance.zh-CN.md)。
