# Public Security Boundary

[English](public-boundary.md) | [简体中文](public-boundary.zh-CN.md)

## Purpose

This policy defines what may enter the public repository, generated packages, documentation, logs, and model-visible adapter surfaces. It applies to source files, Git history, generated output, tests, fixtures, snapshots, build artifacts, source maps, package archives, release notes, issues, and pull requests.

The policy is fail-closed: content is private unless it is explicitly approved for public release.

## Current status

The capability catalog covers 64 public SDK operations through 16 task skills. Operation coverage and channel exposure are separate concerns: an operation remains represented when its policy requires secure input or output and it cannot be exposed as a raw model-visible tool.

The current repository implements catalog, generated-file, bilingual-document, and public-pattern checks together with the shared runtime, controlled CLI, stdio MCP, Streamable HTTP/OpenAPI gateway, adapter source, automated npm-tarball expansion/scanning, and complete Git patch-history scanning. These packages are implemented and tested in source but are not yet published to npm. Full standalone-contract sanitization/parity and vendor-hosted adapter validation remain outside current claims. Automated checks supplement human review; a passing scanner does not authorize content that violates this policy.

## Allowed public content

Public artifacts may contain:

- Public SDK operation metadata and, if later introduced, an approved sanitized public contract artifact.
- Public operation IDs, public methods and paths, and public request or response schemas.
- Task-skill names, safety classifications, provider limitations, and adapter support status.
- Deterministic generators and public validation logic.
- Synthetic examples using obvious placeholders and reserved example domains.
- Public package metadata, changelogs, release notes, and governance documents.
- Redacted error examples and fictional identifiers that cannot be mistaken for production data.

Use placeholders such as:

```text
<api-key>
<one-time-code>
<session-payload>
<signing-secret>
<workspace-id>
<account-id>
<conversation-id>
<message-id>
https://example.invalid/callback
```

Placeholders must describe the data type without preserving the shape or value of a real secret or identifier.

## Prohibited public content

Never commit or publish:

### Private engineering and infrastructure information

- Local filesystem paths, user names, home directories, editor state, or workspace layout.
- Private repository names, locations, branches, commits, source manifests, or issue links.
- Internal-only routes, service names, hosts, ports, network topology, deployment details, or observability endpoints.
- Private implementation notes, stack traces, source excerpts, or logs that reveal non-public architecture.

### Credentials and security material

- API keys, access tokens, passwords, authorization codes, sessions, cookies, private keys, signing secrets, proxy credentials, or cloud credentials.
- Live or expired credentials copied from any real environment.
- Token-shaped examples that could be mistaken for or derived from a real credential.
- Secret values in prompts, MCP payloads, traces, snapshots, command arguments, shell history, or error messages.

### Production and personal data

- Real names, phone numbers, email addresses, avatars, addresses, contact cards, message content, or membership lists.
- Real workspace, account, provider account, conversation, contact, group, message, event, webhook, or request identifiers.
- Production URLs, webhook destinations, logs, analytics, screenshots, database records, or support transcripts.
- Data that is pseudonymized but still linkable to a person or customer.

## Data classes

| Class                   | Examples                                          | Public repository                  | Model-visible MCP/OpenAPI                | Secure CLI/host                              |
| ----------------------- | ------------------------------------------------- | ---------------------------------- | ---------------------------------------- | -------------------------------------------- |
| Public contract         | Approved schemas and operation IDs                | Allowed                            | Allowed when model-safe                  | Allowed                                      |
| Operational metadata    | Request ID, status, bounded pagination cursor     | Allowed only as synthetic examples | Allowed when needed and redacted         | Allowed                                      |
| Sensitive business data | Contacts, messages, group membership              | Synthetic only                     | Minimum necessary for the requested task | Allowed for authorized use                   |
| Secret input            | API key, password, code, session, signing secret  | Never                              | Never as a raw field                     | Allowed through protected channel            |
| One-time secret output  | Newly issued API key or equivalent                | Never                              | Never                                    | Write once through an authorized secure sink |
| Private implementation  | Internal topology, source locations, private logs | Never                              | Never                                    | Not part of this public product              |

## Channel policy

### API authentication

Any runtime or adapter that uses `UNIFYPORT_API_KEY` must read it from the process environment or an approved host secret store. The value must never be accepted as a normal tool parameter, prompt value, ordinary CLI argument, or committed configuration value.

Such a runtime may report whether authentication is configured, but it must never echo the value or a reversible representation.

### MCP and OpenAPI facade

MCP is model-visible. Tool schemas, calls, results, traces, and errors must not contain raw secrets. The implemented server:

- Exposes only `getWorkspace`, `listApiKeys`, and `listProviderRegions` by default.
- Adds only `updateApiKeyStatus` when `UNIFYPORT_ALLOW_WRITES=true` is exact.
- Keeps the other 60 operations on the controlled CLI/Skill surface rather than registering them as model tools.
- Projects exactly the same registry through `GET /openapi.json` and `POST /tools/<tool-name>` for OpenAPI consumers.
- Requires redacted outputs and stable public errors on stdio, Streamable HTTP, and OpenAPI tool calls.

The MCP/OpenAPI adapters must not weaken an operation's classification to increase tool count. Full 64-operation coverage does not imply 64 MCP tools or 64 raw OpenAPI routes. MCP and tool-execution requests require Bearer authentication; schema retrieval does not execute a Device API operation.

### CLI

The controlled CLI may handle secret-bearing operations when it uses:

- Environment variables for API authentication.
- Validated environment references for additional secret input.
- An approved operating-system or host secret store when an adapter provides one.
- A new, pre-reserved `0600` file that is never overwritten for one-time secret output.

Secrets must not appear in ordinary arguments, verbose logs, stack traces, telemetry, or shell completion data.

### Host adapters

Directory installers copy only canonical Skill assets and do not gain access to secrets. They are unprivileged, current-user tools: never run them with `sudo` or in a directory another OS user can modify. POSIX ownership and mode checks enforce this boundary before and during writes; a host without equivalent filesystem isolation must use manual import into a trusted user scope. OpenClaw follows its own CLI trust lifecycle, TRAE is a manual import, Dify connects directly as a Streamable HTTP MCP provider, and Coze consumes the policy-gated OpenAPI facade. Dify and Coze are platform integrations rather than native Agent Skills. If a host or platform cannot guarantee secret isolation from model context and logs, the operation must be disabled or redirected to the controlled CLI.

Confirmation is separate from secret handling. A secure value does not authorize a destructive operation; the adapter must still obtain the required confirmation.

## Operation safety policy

The current catalog records access, confirmation, and channel classification. Generation combines those fields with public SDK mutability, retryability, and secret-input or secret-output flags, plus classified data pointers.

Any shipped runtime or adapter must enforce the following behavior:

- Destructive actions show the resolved target and consequence immediately before execution.
- External communication requires explicit user intent or a narrowly scoped, pre-approved automation policy.
- Every runtime SDK invocation uses `retry: false`; callers may retry only an allowed read under a strict caller-owned bound.
- Writes are not automatically retried without a reviewed idempotency guarantee.
- Asynchronous results use accurate accepted or pending language.
- Provider-unsupported behavior returns an explicit unsupported result.
- The runtime does not auto-paginate. Callers explicitly advance public cursors and bound pagination/polling; cancellation is required where the adapter supports it.

## Contract sanitization boundary (Roadmap)

No standalone contract sanitizer is currently shipped by this repository. If a public contract artifact is introduced, raw input must be processed only in a controlled, temporary synchronization environment. It must never be committed before sanitization, because deleting it later does not remove it from Git history.

The sanitizer must:

1. Parse structured input.
2. Apply only reviewed pointer-level overrides.
3. Preserve protected wire fields.
4. Replace unsafe examples with approved placeholders.
5. Reject unknown documentation changes for manual review.
6. Scan the final contract and all generated artifacts.
7. Emit deterministic output.

Sanitization must not delete a public field or operation merely because it is unsafe for MCP. Keep the wire contract accurate and enforce channel restrictions in policy metadata and adapters.

## Automated validation

Current automated checks cover:

- Catalog schema, `64/64` unique ownership across 16 Skills, mutability, confirmation, secure-channel, and classified-pointer relationships.
- Deterministic generated-file freshness.
- Bilingual Markdown counterparts, language navigation, local links, and Skill frontmatter.
- Source and present generated/build text patterns for known filesystem paths, private-network URLs, provenance metadata, key material, access tokens, JSON Web Tokens, and hard-coded secret assignments.
- Symbolic links and disallowed JavaScript module files.
- Both publishable npm packages are built, packed, safely unpacked, manifest/entry-point validated, and rescanned by `package:check`.
- Complete Git patch history is scanned by `history:check`, including deleted content retained in commits.

Public release approval must separately review all four boundaries: source, generated output, unpacked npm tarballs plus their publication lists, and relevant Git history. Each boundary must reject real local filesystem paths, private or internal implementation details, credentials or credential-shaped values, production/customer data, and PII.

`public:check`, `package:check`, and `history:check` automate the four boundaries, but no scanner reliably detects every contextual PII item or private implementation detail. The text scanner also skips NUL-containing binary content and does not prove standalone-contract structural parity. Human release review must still cover:

- High-entropy, PII, and production-identifier heuristics with reviewed fixtures.
- Exact assertions for approved secret placeholders.
- Full contract tuple and structural parity if a standalone public contract is introduced.
- MCP/OpenAPI schema, call, result, trace, and error checks for secret fields.

Scanner findings require review. Do not suppress a finding with a broad ignore rule; use the narrowest reviewed exception and document why the content is public.

## Exceptions

Exceptions require explicit maintainer and security review. They must be narrow, documented, testable, and time-bounded when appropriate. An exception cannot authorize publishing a credential, personal data, raw private contract, or private infrastructure detail.

## Incident handling

If prohibited data enters a working branch or artifact:

1. Stop publication and sharing.
2. Report the incident through GitHub private vulnerability reporting.
3. Revoke or rotate affected credentials through a private process.
4. Remove the data from artifacts and, when necessary, coordinate Git-history remediation before public release.
5. Scan related branches, archives, caches, and published packages.
6. Add a regression test without copying the exposed value.

Do not paste incident evidence containing secrets or PII into a public issue or pull request.

## Roadmap

- Implement the standalone-contract sanitizer and structural parity gates if a contract artifact is introduced.
- Add contextual PII and high-entropy fixtures without copying real data.
- Add automated checks for bilingual public-boundary drift.
- Add host capability attestations for secret isolation and confirmation support.
- Publish a machine-readable public data-classification schema.
