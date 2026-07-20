# 操作说明

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `listProviderRegions`

- MCP tool：`device_list_provider_regions`
- CLI：`unifyport-agent call listProviderRegions --input-file <path>`
- 策略：`read`、`none`、`model_safe`
- 重试：公开 SDK 允许有界重试

## `listAccounts`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call listAccounts --input-file <path>`
- 策略：`read`、`none`、`projected`
- 重试：公开 SDK 允许有界重试

## `createAccount`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call createAccount --input-file <path>`
- 策略：`write`、`confirm`、`secure_input`
- 重试：禁止自动重试

## `getAccount`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call getAccount --input-file <path>`
- 策略：`read`、`none`、`projected`
- 重试：公开 SDK 允许有界重试

## `updateAccount`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call updateAccount --input-file <path>`
- 策略：`write`、`confirm`、`secure_input`
- 重试：禁止自动重试

## `deleteAccount`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call deleteAccount --input-file <path>`
- 策略：`destructive`、`double_confirm`、`model_safe`
- 重试：禁止自动重试
