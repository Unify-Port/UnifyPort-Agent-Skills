# Operation notes

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `listConversationLabels`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call listConversationLabels --input-file <path>`
- Policy: `read`, `none`, `model_safe`
- Retry: bounded retry permitted by the public SDK

## `setConversationLabelMembers`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call setConversationLabelMembers --input-file <path>`
- Policy: `write`, `intent`, `model_safe`
- Retry: never retry automatically

## `upsertConversationLabel`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call upsertConversationLabel --input-file <path>`
- Policy: `write`, `intent`, `model_safe`
- Retry: never retry automatically

## `deleteConversationLabel`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call deleteConversationLabel --input-file <path>`
- Policy: `destructive`, `confirm`, `model_safe`
- Retry: never retry automatically
