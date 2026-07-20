# Operation notes

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `createGroup`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call createGroup --input-file <path>`
- Policy: `write`, `confirm`, `projected`
- Retry: never retry automatically

## `leaveGroup`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call leaveGroup --input-file <path>`
- Policy: `destructive`, `double_confirm`, `model_safe`
- Retry: never retry automatically

## `updateGroupMembers`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call updateGroupMembers --input-file <path>`
- Policy: `destructive`, `confirm`, `projected`
- Retry: never retry automatically

## `updateGroupInfo`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call updateGroupInfo --input-file <path>`
- Policy: `write`, `confirm`, `model_safe`
- Retry: never retry automatically

## `updateGroupJoinRequests`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call updateGroupJoinRequests --input-file <path>`
- Policy: `destructive`, `double_confirm`, `projected`
- Retry: never retry automatically

## `setGroupJoinApprovalMode`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call setGroupJoinApprovalMode --input-file <path>`
- Policy: `write`, `confirm`, `model_safe`
- Retry: never retry automatically
