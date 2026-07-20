# Maintenance and Release Guide

[English](maintenance.md) | [简体中文](maintenance.zh-CN.md)

## Scope

This guide defines how maintainers synchronize the public contract, regenerate artifacts, preserve 64-operation and 16-skill coverage, validate the public boundary, and publish releases.

## Current status

The current workspace implements six focused checks:

```bash
pnpm capabilities:check
pnpm generate:check
pnpm docs:check
pnpm public:check
pnpm history:check
pnpm package:check
```

`pnpm check` runs these checks together with formatting, linting, tests, type checking, and builds configured by the workspace. The shared runtime, controlled CLI, stdio MCP, Streamable HTTP/OpenAPI gateway, and adapter source are implemented and tested locally, but the npm packages remain unpublished. Full standalone-contract sanitization, standalone-contract structural parity, and vendor-hosted adapter validation are not current claims.

## Sources of truth

| Artifact                                  | Authority                                                    | May be edited manually?        |
| ----------------------------------------- | ------------------------------------------------------------ | ------------------------------ |
| Pinned public SDK dependency              | Public operation and wire metadata                           | Version only, with review      |
| Capability catalog                        | 16-Skill ownership, access, confirmation, and channel policy | Yes, with review               |
| Data-classification policy                | Protected input/output pointers and fail-closed default      | Yes, with security review      |
| Host adapter inventory                    | Reviewed delivery mode and destination metadata              | Yes; vendor E2E still separate |
| Generated capability manifest             | Combined public operation and workflow metadata              | No; generated                  |
| Generated core policy catalog             | Runtime-consumable operation and data policy                 | No; generated                  |
| Generated bilingual Skills and references | Task instructions and operation mapping                      | No; generated                  |
| English and Chinese governance docs       | Public guidance                                              | Yes, together                  |

Non-public contract inputs, source locations, and synchronization artifacts must not be committed, cached in public CI artifacts, printed in logs, or included in package archives.

## Operation catalog synchronization

Review public SDK dependency updates in a clean workspace. Do not copy non-public source material into the repository to perform the update.

### 1. Load public metadata and reviewed policy

- Load the operation inventory from the pinned public SDK.
- Load the capability catalog and data-classification policy structurally.
- Keep the data-policy default at `internal_only` so newly introduced fields do not become model-visible automatically.
- Assign every public SDK operation to exactly one task skill.
- Review access, confirmation, channel, and classified data pointers for each changed operation.
- Use only synthetic placeholders and reserved example domains in repository content.

### 2. Scan the public artifact

The current `public:check` detects known user-home paths, private-network URLs, an internal-route pattern, source-provenance metadata, common credential shapes, symbolic links, and disallowed JavaScript module files. It scans repository text, including generated or build output when present.

The scanner is a guardrail, not a disclosure decision. Reviewers must still reject contextual private implementation details, realistic production identifiers, phone numbers, email addresses, names, message content, logs, screenshots, and other PII that pattern matching may miss.

### 3. Verify catalog parity

`pnpm capabilities:check` compares the catalog with every operation exported by the public SDK and verifies safety relationships. For the current inventory, require:

```text
operation count = 64
unique operationId count = 64
workflow count = 16
missing SDK assignments = 0
duplicate catalog assignments = 0
```

If either expected count changes, stop the normal update and follow the API-change procedure below.

## Generation

After capability validation passes:

1. Run `pnpm generate`.
2. Review the generated capability manifest and core policy catalog.
3. Review the four generated bilingual Skill/reference files for each of the 16 workflows.
4. Run `pnpm generate:check` and require no missing or stale output.
5. Run `pnpm docs:check` and `pnpm public:check`.

Generation is deterministic and offline after dependencies are installed. It must not call a live API, read `UNIFYPORT_API_KEY`, or include environment-specific values.

## Skill coverage validation

Every public operation must have exactly one task-skill owner. The current invariant is `64/64` across 16 skills.

For each operation, require catalog metadata for access, confirmation, and channel. Validation combines this with the public SDK's method, path, mutability, retryability, and secret-input or secret-output flags, plus classified data pointers where a secure channel is required.

Secret operations remain counted when their channel is `secure_input`, `secure_output`, or `secure_input_output`. Do not drop operations to make future MCP coverage appear complete.

## Test matrix

At minimum, releases must validate:

### Current catalog and generator

- Catalog and data-policy schema versions are supported.
- 64 SDK operations have one owner each across 16 workflows.
- Mutability, confirmation, secret-channel, and classified-pointer relationships pass.
- Generation is reproducible and every expected generated file is current.

### Current documentation and public boundary

- Every Markdown document has its bilingual counterpart and language navigation.
- Local Markdown links resolve, and generated Skills have valid frontmatter.
- Known local-path, private-network, provenance, key-material, token, and hard-coded-secret patterns fail the public scan.
- Symbolic links and disallowed JavaScript module files fail the public scan.

### Current runtime, transports, and adapters

The current source tests API-key injection and redaction, stable response shaping, permission switches, confirmation, model-secret isolation, secure references and output sinks, the fixed MCP/OpenAPI allowlist, Streamable HTTP and tool-call authentication, public-bind rejection, and guarded directory installation. Every SDK invocation uses `retry: false`, and the runtime does not auto-paginate. Changes must preserve request timeouts, caller-visible retry/pagination guidance, request-ID propagation, unsupported-capability reporting, and accurate asynchronous state.

Local adapter tests verify generated assets, reviewed destinations, conflict behavior, path containment, and symbolic-link rejection. They do not prove vendor-hosted end-to-end behavior. TRAE, Dify, and Coze must keep their manual/platform integration classifications; only the eight reviewed directory hosts may use `unifyport-agent install`.

### Public package and history boundary

Public release review has four independent surfaces:

1. Scan the source tree, including tests, examples, and documentation.
2. Regenerate and scan generated/build output rather than trusting source inputs alone.
3. Run `pnpm package:check` to build, pack, list, safely unpack, validate, and rescan both npm tarballs.
4. Run `pnpm history:check` to scan the complete patch history; deleting a working-tree file does not remove historical content.

`public:check` scans repository text and includes generated/build output when present. `package:check` builds both publishable packages, packs and safely unpacks their tarballs, validates package manifests and entry points, and applies the same public scan to unpacked content. `history:check` scans complete Git patch history. These are independent gates; a clean source-tree scan alone is insufficient. The text scanner still skips NUL-containing binary content, so package type/path validation and human review remain necessary.

## Public API change procedure

When a reviewed public SDK change adds, removes, or changes an operation:

1. Record the compatibility assessment and reviewed SDK dependency change.
2. Run `pnpm capabilities:check`; new SDK operations must initially fail as unassigned.
3. Assign each new operation to exactly one task skill.
4. Review access, confirmation, channel, and data-pointer classification.
5. Regenerate the manifest, policy catalog, Skills, and references.
6. Update both documentation languages.
7. Run the complete configured validation chain.
8. Decide the appropriate semantic version change.
9. Publish migration guidance for breaking changes.

Do not remove a public operation from the capability catalog to simplify agent behavior. Preserve operation ownership and enforce channel restrictions through policy metadata and adapters.

## Dependency maintenance

- Prefer reviewed, pinned dependency ranges and committed lockfiles.
- Review install scripts, transitive dependency changes, and package provenance.
- Run the complete test and public-boundary suites after updates.
- Avoid generators that download unpinned executables at runtime.
- Treat SDK, YAML parser, HTTP, MCP, archive, and build-tool dependencies as security-sensitive.

## Release checklist

- [ ] Required validation commands exist and pass.
- [ ] SDK operation count and capability-catalog coverage are expected.
- [ ] Generation is reproducible with no uncommitted diff.
- [ ] All operations have unique task-skill ownership.
- [ ] Source-implemented runtime and adapters are present and tested; unpublished and vendor-validation boundaries are explicit.
- [ ] Secret and destructive-operation policies are reviewed.
- [ ] English and Simplified Chinese documents are semantically aligned.
- [ ] Source and generated output pass the public-boundary scan.
- [ ] `pnpm package:check` passes for both npm tarballs and their unpacked payloads.
- [ ] `pnpm history:check` passes for complete patch history.
- [ ] No credential, local path, private host, internal detail, production data, or PII is present.
- [ ] Current status and roadmap language match what actually shipped.
- [ ] Version, changelog, and migration notes are ready.

## Security releases

Handle vulnerability work in a private GitHub security workflow. Minimize patch disclosure until a coordinated release is ready, scan all downstream artifacts, and rotate any potentially exposed test or service credentials through the appropriate private process. Never place incident evidence containing secrets or PII in this public repository.

## Roadmap

- Add approved standalone-contract sanitization and structural parity checks if a public contract artifact is introduced.
- Publish tested adapter support manifests with vendor-validation status for each release.
- Publish signed checksums and verifiable provenance for release artifacts.
- Extend current bilingual-structure checks with semantic-drift validation.
- Add machine-readable provider capability snapshots with freshness metadata.
