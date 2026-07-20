# Operation notes

[English](operations.md) | [简体中文](operations.zh-CN.md)

## `getAccountAuthState`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call getAccountAuthState --input-file <path>`
- Policy: `read`, `none`, `secure_output`
- Retry: bounded retry permitted by the public SDK

## `startAccountAuth`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call startAccountAuth --input-file <path>`
- Policy: `write`, `interactive`, `secure_output`
- Retry: never retry automatically

## `startAccountQrAuth`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call startAccountQrAuth --input-file <path>`
- Policy: `write`, `interactive`, `secure_output`
- Retry: never retry automatically

## `checkAccountQrAuth`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call checkAccountQrAuth --input-file <path>`
- Policy: `write`, `interactive`, `secure_output`
- Retry: never retry automatically

## `submitAccountAuthCode`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call submitAccountAuthCode --input-file <path>`
- Policy: `write`, `interactive`, `secure_input`
- Retry: never retry automatically

## `submitAccountAuthPassword`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call submitAccountAuthPassword --input-file <path>`
- Policy: `write`, `interactive`, `secure_input`
- Retry: never retry automatically

## `importAccountAuthSession`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call importAccountAuthSession --input-file <path>`
- Policy: `write`, `confirm`, `secure_input`
- Retry: never retry automatically

## `cancelAccountAuth`

- MCP tool: not exposed by the released SDK policy
- CLI: `unifyport-agent call cancelAccountAuth --input-file <path>`
- Policy: `write`, `confirm`, `model_safe`
- Retry: never retry automatically
