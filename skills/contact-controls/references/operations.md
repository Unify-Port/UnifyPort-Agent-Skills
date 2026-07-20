# Operation notes

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `blockContact`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call blockContact --input-file <path>`
- Policy: `write`, `confirm`, `projected`
- Retry: never retry automatically

## `unblockContact`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call unblockContact --input-file <path>`
- Policy: `write`, `intent`, `projected`
- Retry: never retry automatically

## `setContactNote`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call setContactNote --input-file <path>`
- Policy: `write`, `intent`, `projected`
- Retry: never retry automatically
