# Operation notes

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `listConversations`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call listConversations --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: bounded retry permitted by the public SDK

## `getConversation`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call getConversation --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: bounded retry permitted by the public SDK

## `listConversationMembers`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call listConversationMembers --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: bounded retry permitted by the public SDK
