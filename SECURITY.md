# Security Policy

[English](SECURITY.md) | [简体中文](SECURITY.zh-CN.md)

Security is a release requirement for UnifyPort Agent Skills. Please report vulnerabilities privately so maintainers can investigate before details become public.

## Reporting a vulnerability

Use **GitHub private vulnerability reporting** for this repository whenever it is available:

1. Open the repository's **Security** tab.
2. Select **Report a vulnerability**.
3. Submit the report privately.

Do not create a public issue, discussion, pull request, or social-media post for an unpatched vulnerability, leaked credential, or suspected exposure of private infrastructure or personal data.

If the private-reporting button is unavailable, use another private, repository-scoped security channel provided by GitHub. This policy intentionally does not publish an unverified security email address.

## What to include

Provide only the minimum information needed to reproduce and assess the issue:

- A concise description and expected security impact.
- The affected release, package, adapter, skill, or generated artifact.
- Reproduction steps using synthetic data and placeholders.
- Whether the issue affects CLI, MCP, a host adapter, generation, packaging, or the public contract.
- Relevant safety classification: authentication, authorization, secret handling, model-visible output, destructive confirmation, retry behavior, public-boundary leak, or supply chain.
- Suggested remediation, if known.

Never include a live API key, password, session, signing secret, private URL, production log, real account identifier, or personal data. If a credential may have been exposed, revoke or rotate it through the appropriate secure process and describe the event using placeholders.

## Response process

Maintainers will use the private report to triage severity, reproduce the issue, coordinate a fix, assess downstream packages, and prepare disclosure. Response and release timing depend on impact and remediation complexity; this policy does not promise a fixed service-level agreement.

Please allow maintainers reasonable time to investigate before public disclosure. Coordinated disclosure details can be agreed in the private report.

## Supported versions

Before the first stable release, security fixes are applied to the actively maintained preview line. After stable releases begin, the release notes and package metadata identify supported versions. Users should upgrade to the latest supported release unless a security advisory says otherwise.

Generated documentation or roadmap text is not evidence that a package or adapter is supported.

## Security-sensitive areas

Reports are especially useful for:

- API keys or other secrets entering prompts, MCP arguments, logs, traces, errors, snapshots, or generated files.
- One-time secret output being repeated, cached, or exposed to the model.
- Missing confirmation on destructive or externally visible operations.
- A write request being retried without a reviewed idempotency guarantee.
- An operation bypassing task-skill ownership or adapter policy.
- Public artifacts containing local paths, private hosts, internal implementation details, credentials, production data, or PII.
- Contract sanitizer or generator behavior that is non-deterministic or fail-open.
- Dependency, package, archive, provenance, or release-integrity issues.
- Host adapters bypassing host-native secret storage or confirmation controls.

## Safe research expectations

- Test only accounts, workspaces, endpoints, and data you are authorized to use.
- Prefer local fixtures, mocks, and synthetic identifiers.
- Do not perform denial of service, bulk messaging, spam, destructive group or account changes, or privacy-invasive testing.
- Do not access, retain, or redistribute another person's data.
- Stop testing if you encounter a real secret or personal data and report it privately.

This repository does not promise a bug bounty or legal safe harbor. Any separate program terms, if published, take precedence for that program.

## Public boundary

For the repository's data-classification and release rules, see [Public Security Boundary](docs/security/public-boundary.md).
