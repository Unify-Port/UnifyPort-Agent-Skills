# UnifyPort Agent Skills runtime

[English](README.md) | [简体中文](README.zh-CN.md) | [Official website](https://www.unifyport.ai/) | [API reference](https://www.unifyport.ai/docs/)

`@unifyport/agent-skills` provides the secure CLI, stdio MCP server, authenticated Streamable HTTP gateway, and policy-gated OpenAPI facade for this repository. It delegates all Device API behavior to `@unifyport/agent-core`.

## Build from source

```bash
pnpm install --frozen-lockfile
pnpm generate:check
pnpm build
pnpm package:check
```

The package is not considered published until a release contains a verified registry artifact.
Run `pnpm check` from the workspace root as the final public-delivery gate.

## Authentication

For CLI and stdio MCP, configure the API key out of band:

```bash
export UNIFYPORT_API_KEY='<your-api-key>'
```

Do not put the value in a prompt, CLI argument, MCP payload, or committed configuration.

## CLI

Write a non-secret request to a file, preview it, then execute it:

```bash
unifyport-agent preview getWorkspace --input-file request.json
unifyport-agent call getWorkspace --input-file request.json
```

Writes require both `UNIFYPORT_ALLOW_WRITES=true` and `--confirm`. Destructive operations additionally
require `UNIFYPORT_ALLOW_DESTRUCTIVE=true` and `--accept-risk`.

Protected inputs use an environment reference:

```bash
export UNIFYPORT_SECRET_AUTH_CODE='<one-time-code>'
unifyport-agent call submitAccountAuthCode \
  --input-file request.json \
  --secret-ref /body/code=env:UNIFYPORT_SECRET_AUTH_CODE \
  --confirm
```

One-time output must be pre-reserved as a new file:

```bash
unifyport-agent call createApiKey \
  --input-file request.json \
  --confirm \
  --secure-output new-secret.json
```

The secure output file is created with mode `0600` and is never overwritten.

Each CLI call performs one SDK request with `retry: false`. The runtime does not auto-paginate or retry. Callers must advance public cursors explicitly, apply page/item ceilings, and retry only an allowed read operation under a strict caller-owned bound.

## MCP

Start the stdio server with:

```bash
unifyport-mcp
```

The released public SDK policy is the hard MCP boundary. The default server exposes three approved
read tools. `UNIFYPORT_ALLOW_WRITES=true` adds the one approved write tool. The remaining operations
stay represented in the 16 Skills and controlled CLI, but are not raw model tools.

## Streamable HTTP gateway

Loopback development:

```bash
unifyport-agent serve
```

The loopback endpoints are:

- `POST http://127.0.0.1:8787/mcp` for Streamable HTTP MCP.
- `GET http://127.0.0.1:8787/openapi.json` for an OpenAPI 3.1 projection of the current tool registry.
- `POST http://127.0.0.1:8787/tools/<tool-name>` for one projected OpenAPI tool call.

MCP and tool calls must carry the Device API key as a Bearer credential. Sessions are stateless and never act as authentication. The schema and health endpoints do not execute Device API operations.

The OpenAPI facade is policy-gated by the same registry as MCP: it contains the three default read tools, or those three plus `updateApiKeyStatus` when `UNIFYPORT_ALLOW_WRITES=true`. It never projects the other 60 controlled CLI/Skill operations as raw API routes. Coze can consume this custom OpenAPI document. Dify should connect directly to the Streamable HTTP MCP endpoint instead.

For a non-loopback bind, the process refuses to start unless public mode, an exact host allowlist, and a TLS certificate/key are all configured. The optional exact origin allowlist only rejects requests that carry an unapproved `Origin` header. The gateway does not emit CORS response headers, so this setting does not enable browser CORS. The gateway applies request-size, header, timeout, and concurrency limits and never logs headers or bodies.

Go and Python backends can use any MCP client that supports Streamable HTTP. See the
[backend examples](../../examples/README.md).
