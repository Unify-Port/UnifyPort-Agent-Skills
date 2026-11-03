# Operation notes

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `createCall`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call createCall --input-file <path>`
- Policy: `write`, `confirm`, `secure_output`
- Retry: never retry automatically

## `getActiveCall`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call getActiveCall --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: never retry automatically

## `hangupCall`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call hangupCall --input-file <path>`
- Policy: `destructive`, `double_confirm`, `projected`
- Retry: never retry automatically
