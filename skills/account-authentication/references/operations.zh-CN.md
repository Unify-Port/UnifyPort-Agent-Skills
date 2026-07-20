# 操作说明

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `getAccountAuthState`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call getAccountAuthState --input-file <path>`
- 策略：`read`、`none`、`secure_output`
- 重试：公开 SDK 允许有界重试

## `startAccountAuth`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call startAccountAuth --input-file <path>`
- 策略：`write`、`interactive`、`secure_output`
- 重试：禁止自动重试

## `startAccountQrAuth`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call startAccountQrAuth --input-file <path>`
- 策略：`write`、`interactive`、`secure_output`
- 重试：禁止自动重试

## `checkAccountQrAuth`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call checkAccountQrAuth --input-file <path>`
- 策略：`write`、`interactive`、`secure_output`
- 重试：禁止自动重试

## `submitAccountAuthCode`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call submitAccountAuthCode --input-file <path>`
- 策略：`write`、`interactive`、`secure_input`
- 重试：禁止自动重试

## `submitAccountAuthPassword`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call submitAccountAuthPassword --input-file <path>`
- 策略：`write`、`interactive`、`secure_input`
- 重试：禁止自动重试

## `importAccountAuthSession`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call importAccountAuthSession --input-file <path>`
- 策略：`write`、`confirm`、`secure_input`
- 重试：禁止自动重试

## `cancelAccountAuth`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call cancelAccountAuth --input-file <path>`
- 策略：`write`、`confirm`、`model_safe`
- 重试：禁止自动重试
