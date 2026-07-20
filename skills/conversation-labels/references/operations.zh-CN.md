# 操作说明

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `listConversationLabels`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call listConversationLabels --input-file <path>`
- 策略：`read`、`none`、`model_safe`
- 重试：公开 SDK 允许有界重试

## `setConversationLabelMembers`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call setConversationLabelMembers --input-file <path>`
- 策略：`write`、`intent`、`model_safe`
- 重试：禁止自动重试

## `upsertConversationLabel`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call upsertConversationLabel --input-file <path>`
- 策略：`write`、`intent`、`model_safe`
- 重试：禁止自动重试

## `deleteConversationLabel`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call deleteConversationLabel --input-file <path>`
- 策略：`destructive`、`confirm`、`model_safe`
- 重试：禁止自动重试
