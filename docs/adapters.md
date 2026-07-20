# Adapter Support

[English](adapters.md) | [简体中文](adapters.zh-CN.md)

## Status and support levels

Adapter source and local tests are implemented in this repository, but the npm package is not yet published. The support levels below describe the delivery mechanism that the source implements; they do not claim installation from npm or end-to-end validation in a vendor-hosted environment.

All adapters consume the canonical assets under `skills/`. They do not broaden the MCP allowlist, move secrets into model context, or replace the controlled CLI for secure-channel operations.

| Host or platform | Support level                | Delivery mechanism                                                 |
| ---------------- | ---------------------------- | ------------------------------------------------------------------ |
| Codex            | Native directory installer   | Project `.agents/skills` or user `.codex/skills` directory         |
| Claude Code      | Native directory installer   | Project or user `.claude/skills` directory                         |
| Cursor           | Native directory installer   | Project or user `.cursor/skills` directory                         |
| Gemini CLI       | Native directory installer   | Project or user `.gemini/skills` directory                         |
| GitHub Copilot   | Native directory installer   | Project `.github/skills` or user `.copilot/skills` directory       |
| Kimi Code        | Native directory installer   | Project or user `.kimi-code/skills` directory                      |
| Qwen Code        | Native directory installer   | Project or user `.qwen/skills` directory                           |
| Qoder            | Native directory installer   | Project or user `.qoder/skills` directory                          |
| OpenClaw         | CLI staging and instructions | Install each canonical Skill with the OpenClaw CLI                 |
| TRAE             | Manual import                | Import the canonical Skill content through the TRAE user interface |
| Dify             | Platform integration recipe  | Configure a Streamable HTTP MCP provider for `/mcp`                |
| Coze             | Platform integration recipe  | Import `/openapi.json` as a custom OpenAPI plugin                  |

Dify and Coze are platform integrations, not native Agent Skills. TRAE is a manual import, not a directory installer. OpenClaw uses its own CLI lifecycle rather than the repository's directory installer.

## Directory installers

After building from source, install all 16 canonical Skills into a supported host directory:

```bash
unifyport-agent install --host codex --scope project
```

Replace `codex` with `claude-code`, `cursor`, `gemini-cli`, `github-copilot`, `kimi-code`, `qwen-code`, or `qoder`. Use `--scope user` only when a user-level installation is intended.

The installer resolves only reviewed relative destinations, rejects symbolic-link destinations, checks every file before writing, and does not overwrite a conflict unless `--force` is explicit. On POSIX it also refuses root/elevated execution, a root not owned by the current effective user, and group- or world-writable installation directories; newly created directories use mode `0700`. Run it only in a directory exclusively controlled by the current OS user—never with `sudo` or inside a shared attacker-writable tree. Standard cross-platform Node.js filesystem APIs cannot anchor every write to a directory handle, so this single-user directory boundary is part of the installer threat model.

Each file is written atomically, the complete set is preflighted for known conflicts, and a failed multi-file write triggers a best-effort reverse rollback of files committed by that run. A catastrophic filesystem or rollback failure returns `INSTALL_ROLLBACK_FAILED`; inspect the target before rerunning. An ordinary rerun safely skips identical files. The installer writes generated copies of the canonical assets; edit `skills/` and regenerate instead of editing installed or generated copies as a source of truth.

## OpenClaw CLI

OpenClaw expects one Skill directory per install command. From a reviewed source checkout, install each directory using the [OpenClaw Skills CLI](https://docs.openclaw.ai/cli/skills):

```bash
openclaw skills install <skill-directory>
```

Review the staged Skill before installation and use OpenClaw's own scope, trust, and update controls. This repository supplies canonical Skill content and instructions; it does not replace OpenClaw's installer or claim that the Skills have been exercised against every OpenClaw deployment.

## TRAE manual import

TRAE is intentionally marked `manual_import`. Review a canonical Skill directory, then import its `SKILL.md` and required reference files through the TRAE user interface. Do not treat a `.trae/skills` copy as a supported native installation, and do not paste credentials into imported instructions.

## Dify and Coze

Dify and Coze consume platform-specific integration recipes rather than Agent Skill directories:

- Dify connects directly to the authenticated Streamable HTTP MCP endpoint as an MCP provider.
- Coze imports `GET /openapi.json` as a custom OpenAPI plugin and invokes the projected `POST /tools/<tool-name>` routes.

Deploy the gateway only after applying the [remote gateway controls](../README.md#remote-gateway-boundary). Store the Bearer API key in the platform's protected credential facility and require it on every MCP or tool-execution request. Both integrations expose only the policy-gated registry: the default set is `getWorkspace`, `listApiKeys`, and `listProviderRegions`; `UNIFYPORT_ALLOW_WRITES=true` adds only `updateApiKeyStatus`. The OpenAPI facade is not a 64-operation raw API, and the remaining operations stay on the controlled CLI/Skills surface.

Browser CORS is not enabled. `UNIFYPORT_GATEWAY_ALLOWED_ORIGINS` only rejects requests that include an unapproved `Origin` header; the gateway does not emit CORS response headers.

These recipes describe the supported boundary but are not claims of vendor marketplace publication, native Agent Skill support, or completed vendor-hosted end-to-end certification.

## Verification

Before distributing adapter output:

```bash
pnpm generate:check
pnpm docs:check
pnpm public:check
pnpm history:check
pnpm test
pnpm typecheck
pnpm package:check
```

Use `pnpm check` as the final aggregate gate. `history:check` scans complete patch history, while `package:check` builds, packs, unpacks, and scans both npm tarballs as described in the [maintenance guide](maintenance.md).
