# Operation notes

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `listProviderRegions`

- MCP tool: `device_list_provider_regions`
- CLI: `unifyport-agent call listProviderRegions --input-file <path>`
- Policy: `read`, `none`, `model_safe`
- Retry: bounded retry permitted by the public SDK

## `listAccounts`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call listAccounts --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: bounded retry permitted by the public SDK

## `createAccount`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call createAccount --input-file <path>`
- Policy: `write`, `confirm`, `secure_input`
- Retry: never retry automatically

## `getAccount`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call getAccount --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: bounded retry permitted by the public SDK

## `updateAccount`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call updateAccount --input-file <path>`
- Policy: `write`, `confirm`, `secure_input`
- Retry: never retry automatically

## `deleteAccount`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call deleteAccount --input-file <path>`
- Policy: `destructive`, `double_confirm`, `model_safe`
- Retry: never retry automatically
