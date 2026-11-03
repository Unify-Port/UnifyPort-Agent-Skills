# Operation notes

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `listPosts`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call listPosts --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: never retry automatically

## `getPost`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call getPost --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: never retry automatically

## `listPostComments`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call listPostComments --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: never retry automatically

## `replyPostComment`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call replyPostComment --input-file <path>`
- Policy: `write`, `confirm`, `projected`
- Retry: never retry automatically
