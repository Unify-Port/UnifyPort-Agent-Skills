# Operation notes

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `listContacts`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call listContacts --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: bounded retry permitted by the public SDK

## `getContact`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call getContact --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: bounded retry permitted by the public SDK

## `listContactBlocklist`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call listContactBlocklist --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: bounded retry permitted by the public SDK

## `createContact`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call createContact --input-file <path>`
- Policy: `write`, `confirm`, `projected`
- Retry: never retry automatically

## `getContactMembership`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call getContactMembership --input-file <path>`
- Policy: `read`, `none`, `projected`
- Retry: never retry automatically
