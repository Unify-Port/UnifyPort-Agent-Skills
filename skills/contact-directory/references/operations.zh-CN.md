# 操作说明

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `listContacts`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call listContacts --input-file <path>`
- 策略：`read`、`none`、`projected`
- 重试：公开 SDK 允许有界重试

## `getContact`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call getContact --input-file <path>`
- 策略：`read`、`none`、`projected`
- 重试：公开 SDK 允许有界重试

## `listContactBlocklist`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call listContactBlocklist --input-file <path>`
- 策略：`read`、`none`、`projected`
- 重试：公开 SDK 允许有界重试

## `createContact`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call createContact --input-file <path>`
- 策略：`write`、`confirm`、`projected`
- 重试：禁止自动重试

## `getContactMembership`

- MCP tool：公开 SDK 策略不允许暴露
- CLI：`unifyport-agent call getContactMembership --input-file <path>`
- 策略：`read`、`none`、`projected`
- 重试：禁止自动重试
