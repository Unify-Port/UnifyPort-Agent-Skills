# 操作说明

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `createGroup`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call createGroup --input-file <path>`
- 策略：`write`、`confirm`、`projected`
- 重试：禁止自动重试

## `leaveGroup`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call leaveGroup --input-file <path>`
- 策略：`destructive`、`double_confirm`、`model_safe`
- 重试：禁止自动重试

## `updateGroupMembers`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call updateGroupMembers --input-file <path>`
- 策略：`destructive`、`confirm`、`projected`
- 重试：禁止自动重试

## `updateGroupInfo`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call updateGroupInfo --input-file <path>`
- 策略：`write`、`confirm`、`model_safe`
- 重试：禁止自动重试

## `updateGroupJoinRequests`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call updateGroupJoinRequests --input-file <path>`
- 策略：`destructive`、`double_confirm`、`projected`
- 重试：禁止自动重试

## `setGroupJoinApprovalMode`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call setGroupJoinApprovalMode --input-file <path>`
- 策略：`write`、`confirm`、`model_safe`
- 重试：禁止自动重试
