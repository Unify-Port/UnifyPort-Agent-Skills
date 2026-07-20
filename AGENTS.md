# Repository instructions

[English](AGENTS.md) | [简体中文](AGENTS.zh-CN.md)

## Public boundary

- This is a public repository. Use only approved public Device API contracts and released public
  packages.
- Never add private repository names, local paths, internal routes, private hosts, source provenance,
  credentials, personal data, customer data, or realistic secret examples.
- Do not copy an internal contract and delete sensitive text later. A sensitive value must never enter
  Git history.
- `UNIFYPORT_API_KEY` is out-of-band configuration. It must not appear in prompts, tool arguments,
  logs, snapshots, generated files, or error messages.

## Source of truth

- `capabilities/catalog.yaml` owns the 64-operation to 16-Skill mapping and operation risk policy.
- `policies/data-classification.yaml` owns field handling and secure-channel rules.
- `skills/` is canonical. Host-specific adapters are generated; do not edit generated copies.
- Generated files must be changed through their source and generator.

## Development

- Use TypeScript for runtime and tooling. Do not add `.mjs` files.
- Keep English and Simplified Chinese documentation semantically complete.
- Comments must be concise Chinese explanations of intent, boundaries, compatibility, external
  constraints, or risk. Do not narrate obvious code.
- New operations and fields fail closed until they receive an explicit workflow and data policy.
- Read-only tools are the default. Writes and destructive operations require separate runtime opt-ins;
  secret inputs use references and secret outputs use a secure sink.
- Run `pnpm check` before public delivery. Report any check that could not run.
