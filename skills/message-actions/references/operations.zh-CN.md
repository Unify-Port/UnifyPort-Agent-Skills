# 操作说明

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `pinMessage`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call pinMessage --input-file <path>`
- 策略：`write`、`intent`、`model_safe`
- 重试：禁止自动重试

## `revokeMessage`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call revokeMessage --input-file <path>`
- 策略：`destructive`、`double_confirm`、`model_safe`
- 重试：禁止自动重试

## `reactMessage`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call reactMessage --input-file <path>`
- 策略：`write`、`intent`、`model_safe`
- 重试：禁止自动重试

## `editMessage`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call editMessage --input-file <path>`
- 策略：`destructive`、`confirm`、`projected`
- 重试：禁止自动重试
