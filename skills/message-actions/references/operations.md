# Operation notes

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `pinMessage`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call pinMessage --input-file <path>`
- Policy: `write`, `intent`, `model_safe`
- Retry: never retry automatically

## `revokeMessage`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call revokeMessage --input-file <path>`
- Policy: `destructive`, `double_confirm`, `model_safe`
- Retry: never retry automatically

## `reactMessage`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call reactMessage --input-file <path>`
- Policy: `write`, `intent`, `model_safe`
- Retry: never retry automatically

## `editMessage`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call editMessage --input-file <path>`
- Policy: `destructive`, `confirm`, `projected`
- Retry: never retry automatically
