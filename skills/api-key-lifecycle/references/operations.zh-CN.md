# 操作说明

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `listApiKeys`

- MCP tool：`device_list_api_keys`
- CLI：`unifyport-agent call listApiKeys --input-file <path>`
- 策略：`read`、`none`、`model_safe`
- 重试：公开 SDK 允许有界重试

## `createApiKey`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call createApiKey --input-file <path>`
- 策略：`write`、`confirm`、`secure_output`
- 重试：禁止自动重试

## `updateApiKeyStatus`

- MCP tool：`device_update_api_key_status`
- CLI：`unifyport-agent call updateApiKeyStatus --input-file <path>`
- 策略：`write`、`confirm`、`model_safe`
- 重试：禁止自动重试

## `rotateApiKey`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call rotateApiKey --input-file <path>`
- 策略：`destructive`、`double_confirm`、`secure_output`
- 重试：禁止自动重试
