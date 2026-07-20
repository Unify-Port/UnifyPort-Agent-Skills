# 操作说明

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `listGroups`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call listGroups --input-file <path>`
- 策略：`read`、`none`、`projected`
- 重试：公开 SDK 允许有界重试

## `getGroup`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call getGroup --input-file <path>`
- 策略：`read`、`none`、`projected`
- 重试：公开 SDK 允许有界重试

## `listGroupJoinRequests`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call listGroupJoinRequests --input-file <path>`
- 策略：`read`、`none`、`projected`
- 重试：公开 SDK 允许有界重试

## `getGroupInviteCode`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call getGroupInviteCode --input-file <path>`
- 策略：`read`、`intent`、`secure_output`
- 重试：公开 SDK 允许有界重试
