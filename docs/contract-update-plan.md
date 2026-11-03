# Contract update validation

[English](contract-update-plan.md) | [简体中文](contract-update-plan.zh-CN.md)

The runtime uses published `@unifyport/sdk-node@0.5.0`: 78 operations in 18 task workflows. Agent packages remain unpublished. Generated Skills, policies and adapters share the same catalog. MCP remains three default tools and four with writes enabled.

Account lifecycle includes bounded pagination, caller-owned creation Idempotency-Key, and operation lookup after 202 deletion. Legacy 204 needs no operation lookup. Authentication includes auth sessions and Passkey; provider data/proxy/protocol objects use JSON secret references, while WebAuthn response is a protected serialized string. Creation/update provider profiles, send reply tokens, authorization material and call join URLs require secure output reservation before execution.

Posts/comments and calls are separate workflows. POST reads remain reads. Call creation requires write approval, hangup also requires destructive opt-in and risk acceptance; server private beta eligibility still applies. History requests are asynchronous best effort, not guaranteed replay. No ambiguous write is retried automatically.

Facebook supports session creation/import only. Select an allocatable region, provide a short-lived controlled session URL through a secret reference and check runtime separately after authorization. Send only when running, using an unchanged string ID from an E2EE user conversation. One text or media item per send; audio is partial. Groups, quotes, mentions, caption, message actions, contacts, posts/comments and calls are not implied by the provider enum.

The released contract has 24 event names. Facebook uses four existing callbacks: message.received may be inbound or outbound; account.auth.succeeded requires a runtime check; account.status.updated runtime error is not authorization revocation; account.auth.failed is separate. Preserve sparse values, false/zero, string identifiers and timestamp precision. Native media duration has no confirmed public unit.

Validate with `pnpm check`, including generated drift, public boundary, tests, type checks and packed-package consumption. Offline verification is distinct from real-account delivery. Publishing requires a separate approved release.
