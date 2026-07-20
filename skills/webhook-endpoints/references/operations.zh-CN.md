# 操作说明

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `listWebhookEndpoints`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call listWebhookEndpoints --input-file <path>`
- 策略：`read`、`none`、`model_safe`
- 重试：公开 SDK 允许有界重试

## `createWebhookEndpoint`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call createWebhookEndpoint --input-file <path>`
- 策略：`write`、`confirm`、`secure_input`
- 重试：禁止自动重试

## `getWebhookEndpoint`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call getWebhookEndpoint --input-file <path>`
- 策略：`read`、`none`、`model_safe`
- 重试：公开 SDK 允许有界重试

## `updateWebhookEndpoint`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call updateWebhookEndpoint --input-file <path>`
- 策略：`write`、`confirm`、`secure_input`
- 重试：禁止自动重试

## `deleteWebhookEndpoint`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call deleteWebhookEndpoint --input-file <path>`
- 策略：`destructive`、`double_confirm`、`model_safe`
- 重试：禁止自动重试

## `deactivateWebhookEndpoint`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call deactivateWebhookEndpoint --input-file <path>`
- 策略：`write`、`confirm`、`model_safe`
- 重试：禁止自动重试
