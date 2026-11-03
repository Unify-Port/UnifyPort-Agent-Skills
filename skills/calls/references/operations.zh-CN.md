# 操作说明

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `createCall`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call createCall --input-file <path>`
- 策略：`write`、`confirm`、`secure_output`
- 重试：禁止自动重试

## `getActiveCall`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call getActiveCall --input-file <path>`
- 策略：`read`、`none`、`projected`
- 重试：禁止自动重试

## `hangupCall`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call hangupCall --input-file <path>`
- 策略：`destructive`、`double_confirm`、`projected`
- 重试：禁止自动重试
