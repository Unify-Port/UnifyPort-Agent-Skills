# UnifyPort Agent Skills

[English](README.md) | [简体中文](README.zh-CN.md) | [Official website](https://www.unifyport.ai/) | [API reference](https://www.unifyport.ai/docs/)

UnifyPort Agent Skills is the public, safety-oriented integration layer for using the UnifyPort Device API from AI agents. The repository combines public SDK operation metadata, a shared safety policy, task-level Skills, a controlled CLI, MCP transports, and host/platform adapters.

## Current status

The public SDK exports **64 operations**, and the capability catalog assigns every operation to exactly one of **16 task Skills**. The shared runtime, controlled CLI, stdio MCP server, authenticated Streamable HTTP gateway, and adapter source are implemented and tested in this repository. The npm packages have **not yet been published**; build and evaluate them from source until a verified registry release is announced.

Source implementation is not the same as vendor deployment. Directory installers and the OpenClaw staging metadata are tested locally; TRAE remains a manual import, and Dify/Coze use platform integration recipes. No adapter is claimed as end-to-end validated in a vendor-hosted environment.

## Design goals

- Require only `UNIFYPORT_API_KEY` for ordinary authenticated API access.
- Preserve exact public wire behavior while presenting task-oriented agent workflows.
- Keep one canonical operation catalog across generated clients, skills, CLI, MCP, and host adapters.
- Default to least privilege, caller-bounded pagination, redacted logs, and explicit confirmation for consequential actions.
- Keep secrets, private infrastructure details, and personal data outside public artifacts and model-visible channels.

## The 16 task skills

| Skill                    | Purpose                                                         | Default exposure              |
| ------------------------ | --------------------------------------------------------------- | ----------------------------- |
| `workspace-overview`     | Validate access and inspect the current workspace               | Read-only                     |
| `workspace-settings`     | Change workspace settings                                       | Admin, confirmation required  |
| `api-key-lifecycle`      | List, create, enable, disable, and rotate API keys              | Admin, secure output required |
| `account-lifecycle`      | Discover regions and manage connected accounts                  | Guarded                       |
| `account-authentication` | Complete QR, code, password, or session authorization workflows | Interactive secure channel    |
| `account-runtime`        | Refresh, start, stop, or reconnect an account                   | Guarded                       |
| `conversation-explorer`  | List conversations and inspect conversation details or members  | Read-only                     |
| `conversation-state`     | Change read, mute, or pin state                                 | Explicit user intent          |
| `conversation-labels`    | List and manage conversation labels                             | Guarded                       |
| `contact-directory`      | Search contacts and inspect contact state                       | Read-only, sensitive data     |
| `contact-controls`       | Block, unblock, or annotate contacts                            | Guarded                       |
| `group-explorer`         | Inspect groups, join requests, and invite information           | Read-only, sensitive data     |
| `group-administration`   | Create or modify groups and membership                          | High-impact confirmation      |
| `message-sender`         | Send text, media, file, contact, reply, or mention messages     | External side effect          |
| `message-actions`        | Pin, revoke, react to, or edit existing messages                | Guarded                       |
| `webhook-endpoints`      | Manage event delivery endpoints                                 | Admin, secure input required  |

The mapping is a coverage invariant: all 64 public `operationId` values must be present once, with no missing or duplicate ownership.

## Runtime, CLI, and MCP

The implemented shared runtime owns authentication, request construction, response envelopes, stable error codes, request IDs, timeout enforcement, redaction, and safety metadata. It passes `retry: false` to the SDK and does not auto-paginate; retryability and pagination remain policy guidance that callers must apply explicitly and with bounds. Every adapter delegates API execution to that runtime rather than reimplementing it.

- **Controlled CLI:** represents all 64 operations and is the required surface for workflows that need secure input, one-time secret output, or confirmation. Writes require `UNIFYPORT_ALLOW_WRITES=true`; destructive operations require the separate `UNIFYPORT_ALLOW_DESTRUCTIVE=true` switch.
- **stdio MCP:** exposes only `getWorkspace`, `listApiKeys`, and `listProviderRegions` by default. Setting `UNIFYPORT_ALLOW_WRITES=true` adds `updateApiKeyStatus`; the other 60 operations remain available through Skills and the controlled CLI, not as raw model tools.
- **Streamable HTTP and OpenAPI facade:** `/mcp` exposes the MCP allowlist through a stateless gateway. `GET /openapi.json` projects the same registered tools, and `POST /tools/<tool-name>` invokes one projected tool for OpenAPI consumers. Tool execution requires the Device API key as a Bearer credential; the schema and health endpoints do not execute Device API operations.
- **Host/platform adapters:** install canonical Skill assets or provide an explicit integration recipe without changing the runtime policy.

See [Adapter support](docs/adapters.md) for exact support levels and installation modes. Source presence does not mean npm publication or vendor-hosted end-to-end validation.

## Authentication

Provide the API key through the process environment or an approved host secret store:

```bash
export UNIFYPORT_API_KEY='<your-api-key>'
```

Do not place an API key in a prompt, command argument, configuration committed to Git, MCP tool payload, test fixture, or log. The runtime maps the value to the public API authentication header and must redact it from diagnostics.

Some workflows need additional protected values, such as a one-time authorization code, password, imported session, webhook signing secret, or newly issued API key. These operations remain part of the 64-operation coverage, but they must use CLI secure input or a host-provided secure channel. They are not raw model-facing MCP tools.

## Build from source

Node.js 22.12 or newer and pnpm 10 are required:

```bash
pnpm install --frozen-lockfile
pnpm generate:check
pnpm build
```

The npm names and executable entry points in this source tree are pre-release interfaces until a verified registry artifact is published. CLI, stdio MCP, and Streamable HTTP usage is documented in the [runtime package guide](packages/server/README.md); installer usage is documented in [Adapter support](docs/adapters.md).

### Remote gateway boundary

`unifyport-agent serve` listens on `127.0.0.1:8787` by default. A non-loopback bind fails closed unless all of the following are configured:

- `UNIFYPORT_GATEWAY_PUBLIC=true`.
- An exact `UNIFYPORT_GATEWAY_ALLOWED_HOSTS` allowlist.
- Direct TLS certificate and key files.
- An optional exact origin allowlist to reject requests carrying an unapproved `Origin` header.

The gateway does not emit CORS response headers, so the origin allowlist does not enable browser CORS. It applies body-size, header, request-timeout, keep-alive, and concurrency limits, does not treat an MCP session as authentication, and does not log request headers or bodies. The OpenAPI facade contains only the same three default tools, or four when writes are explicitly enabled; it is not a 64-operation raw API. See [.env.example](.env.example) and the [Go and Python examples](examples/README.md).

## Generation and validation

Generated artifacts flow in one direction:

```text
public SDK operation metadata
  + capability catalog and data-classification policy
  -> generated capability manifest and runtime policy
  -> generated bilingual task skills and operation references
  -> shared runtime, controlled CLI, MCP transports, and adapter assets
```

The current pipeline fails closed on missing or duplicate ownership, unsafe policy widening, missing secret-channel classifications, stale generated files, broken bilingual links, and known public-boundary patterns. Human review remains required for contextual private information and personal data that pattern matching cannot identify reliably.

The validation commands implemented by the current workspace are:

```bash
pnpm capabilities:check
pnpm generate:check
pnpm docs:check
pnpm public:check
pnpm history:check
pnpm package:check
```

The recommended final gate is `pnpm check`, which runs the complete configured validation chain. Use commands only when they are present in the checked-out release. CI and release metadata are authoritative for current implementation status.

## Safety defaults

- The runtime disables SDK retries. A caller may explicitly retry a read only when policy metadata allows it and the caller applies a strict bound.
- Write operations are not retried automatically without an operation-specific idempotency guarantee.
- Destructive or externally visible operations require confirmation immediately before execution.
- The runtime does not auto-paginate; callers must advance public cursors explicitly and enforce maximum page and item limits.
- Provider-specific limitations are reported as capabilities or stable errors, never silently ignored.
- Sensitive response fields are minimized and redacted from logs and model-visible output.
- Webhook delivery is asynchronous and requires an independently operated receiver; configuring an endpoint does not create that receiver.

## Documentation

- [Architecture](docs/architecture.md)
- [Adapter support](docs/adapters.md)
- [Maintenance and contract synchronization](docs/maintenance.md)
- [Public security boundary](docs/security/public-boundary.md)
- [Contributing](CONTRIBUTING.md)
- [Security policy](SECURITY.md)

## Roadmap

- Publish verified npm artifacts for the implemented runtime and CLI/MCP package.
- Complete vendor-specific adapter verification without weakening the common policy boundary.
- Publish machine-readable adapter support and provider capability matrices.
- Add signed release provenance and reproducible package verification.
- Expand secure platform integrations without moving secrets into model context.
