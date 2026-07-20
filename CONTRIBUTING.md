# Contributing to UnifyPort Agent Skills

[English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING.zh-CN.md)

Thank you for helping improve UnifyPort Agent Skills. Contributions are welcome when they preserve the public security boundary, deterministic generation, exact operation coverage, and bilingual documentation.

## Before you begin

- Read [the architecture](docs/architecture.md), [the maintenance guide](docs/maintenance.md), and [the public boundary policy](docs/security/public-boundary.md).
- Use the package manager and runtime versions declared by the checked-out release.
- Check that an adapter package, entry point, and tests exist in the checked-out release before treating the adapter as implemented.
- For a vulnerability or suspected secret exposure, do not open a public issue. Follow [SECURITY.md](SECURITY.md).

## What belongs in this repository

Appropriate contributions include:

- Task-skill instructions and safety metadata.
- Shared runtime behavior that is derived from the public API contract.
- Deterministic generators, public-boundary scanners, and parity checks.
- CLI, MCP, and host adapters that enforce the shared policy.
- Tests, public examples, and bilingual documentation.

Do not add local filesystem paths, private repository details, private routes or hosts, service topology, credentials, session material, production logs, real identifiers, or personal data. Use approved placeholders such as `<api-key>`, `<account-id>`, and `https://example.invalid/callback`.

## Development workflow

1. Start from an up-to-date branch and keep the change focused.
2. Identify whether the change affects the public contract, generated output, a task skill, an adapter, or documentation.
3. Update source files rather than generated artifacts.
4. Add or update tests for behavior, safety classification, and failure cases.
5. Update English and Simplified Chinese documentation together.
6. Run the validation commands supplied by the checked-out release.
7. Open a pull request that explains the user outcome, security impact, generated changes, and validation evidence.

Do not commit secrets or use real customer data in tests, snapshots, examples, screenshots, or issue descriptions.

## Public operation changes

The current operation inventory is loaded from the public SDK metadata. Do not copy a non-public contract, source location, or synchronization artifact into this repository, even temporarily, because Git history is durable.

A public SDK dependency or capability-catalog change must preserve these invariants unless an explicitly reviewed public API version changes them:

- Each operation has a unique `operationId` and exactly one task-skill owner.
- Catalog access classification cannot weaken the public SDK mutability classification.
- Secret input and output declarations map to an approved secure channel and classified data pointers.
- No local path, private host, implementation detail, credential, or personal data reaches the public artifact.

The current inventory contains 64 operations. If the count changes, the pull request must explain the public API change, update the capability catalog and data policy, regenerate artifacts, and include an explicit compatibility review.

## Generated files

Generated types, operation metadata, adapter manifests, and coverage reports must be reproducible. Do not hand-edit them.

The standard checks are:

```bash
pnpm capabilities:check
pnpm generate:check
pnpm docs:check
pnpm public:check
```

Run `pnpm check` for the complete configured validation chain. Only run commands that exist in the current release. A missing required check is a release blocker, not permission to skip validation.

## Task-skill ownership

All public operations must map to exactly one of the 16 task skills. When adding or moving an operation:

- Update the machine-readable ownership manifest.
- Preserve `64/64` coverage unless the public contract itself changed.
- Reject missing and duplicate ownership.
- Document cross-skill prerequisites rather than copying the same operation into multiple skills.
- Keep secret-bearing operations in coverage even when they are CLI-only or require a host secure channel.

Skill instructions must identify read, write, destructive, secret, human-in-the-loop, asynchronous, and provider-limited behavior. Consequential operations must have an immediate confirmation gate.

## Adapter rules

- Adapters call the shared runtime; they do not create independent HTTP clients with different behavior.
- MCP exposes only model-safe inputs and outputs.
- CLI accepts secrets through environment variables, protected standard input, or an approved secret store, never ordinary command arguments.
- Host adapters must use host-native secret and confirmation capabilities when available.
- Unsupported capabilities must return a clear unsupported status; do not simulate success.
- Write operations must not gain automatic retries without a reviewed idempotency guarantee.

## Documentation parity

Every public governance or architecture change must update the English and Simplified Chinese versions in the same pull request. The two versions must have the same meaning, safety requirements, current-status statements, and roadmap boundaries. Literal sentence-by-sentence translation is not required, but omissions are not acceptable.

## Pull request checklist

- [ ] The change is scoped and does not include unrelated generated output.
- [ ] No secret, private infrastructure detail, local path, production data, or PII is present.
- [ ] Public contract and operation-lock checks pass when applicable.
- [ ] All operations still have unique task-skill ownership.
- [ ] Read/write/destructive/secret/HIL/async/provider metadata is correct.
- [ ] CLI, MCP, and host behavior remains aligned through the shared runtime.
- [ ] Tests cover success, stable API errors, and safety failures.
- [ ] English and Simplified Chinese documentation are semantically aligned.
- [ ] Current status and roadmap items are not presented as completed features.

Maintainers may request additional public-boundary review for contract, generator, authentication, secret-channel, destructive-action, or release changes.
