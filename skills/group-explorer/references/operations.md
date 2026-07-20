# Operation notes

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `listGroups`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call listGroups --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: bounded retry permitted by the public SDK

## `getGroup`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call getGroup --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: bounded retry permitted by the public SDK

## `listGroupJoinRequests`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call listGroupJoinRequests --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: bounded retry permitted by the public SDK

## `getGroupInviteCode`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call getGroupInviteCode --input-file <path>`
- Policy: `read`, `intent`, `secure_output`
- Retry: bounded retry permitted by the public SDK
