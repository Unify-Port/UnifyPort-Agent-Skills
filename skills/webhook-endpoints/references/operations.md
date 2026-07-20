# Operation notes

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `listWebhookEndpoints`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call listWebhookEndpoints --input-file <path>`
- Policy: `read`, `none`, `model_safe`
- Retry: bounded retry permitted by the public SDK

## `createWebhookEndpoint`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call createWebhookEndpoint --input-file <path>`
- Policy: `write`, `confirm`, `secure_input`
- Retry: never retry automatically

## `getWebhookEndpoint`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call getWebhookEndpoint --input-file <path>`
- Policy: `read`, `none`, `model_safe`
- Retry: bounded retry permitted by the public SDK

## `updateWebhookEndpoint`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call updateWebhookEndpoint --input-file <path>`
- Policy: `write`, `confirm`, `secure_input`
- Retry: never retry automatically

## `deleteWebhookEndpoint`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call deleteWebhookEndpoint --input-file <path>`
- Policy: `destructive`, `double_confirm`, `model_safe`
- Retry: never retry automatically

## `deactivateWebhookEndpoint`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call deactivateWebhookEndpoint --input-file <path>`
- Policy: `write`, `confirm`, `model_safe`
- Retry: never retry automatically
