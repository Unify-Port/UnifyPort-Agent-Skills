# Operation notes

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `listApiKeys`

- MCP tool: `device_list_api_keys`
- CLI: `unifyport-agent call listApiKeys --input-file <path>`
- Policy: `read`, `none`, `model_safe`
- Retry: bounded retry permitted by the public SDK

## `createApiKey`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call createApiKey --input-file <path>`
- Policy: `write`, `confirm`, `secure_output`
- Retry: never retry automatically

## `updateApiKeyStatus`

- MCP tool: `device_update_api_key_status`
- CLI: `unifyport-agent call updateApiKeyStatus --input-file <path>`
- Policy: `write`, `confirm`, `model_safe`
- Retry: never retry automatically

## `rotateApiKey`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call rotateApiKey --input-file <path>`
- Policy: `destructive`, `double_confirm`, `secure_output`
- Retry: never retry automatically
