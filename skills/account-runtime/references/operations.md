# Operation notes

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `refreshAccountRuntime`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call refreshAccountRuntime --input-file <path>`
- Policy: `write`, `intent`, `model_safe`
- Retry: never retry automatically

## `startAccountRuntime`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call startAccountRuntime --input-file <path>`
- Policy: `write`, `intent`, `model_safe`
- Retry: never retry automatically

## `stopAccountRuntime`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call stopAccountRuntime --input-file <path>`
- Policy: `write`, `confirm`, `model_safe`
- Retry: never retry automatically

## `reconnectAccountRuntime`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call reconnectAccountRuntime --input-file <path>`
- Policy: `write`, `confirm`, `model_safe`
- Retry: never retry automatically
