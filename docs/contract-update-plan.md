# Contract update readiness

[English](contract-update-plan.md) | [简体中文](contract-update-plan.zh-CN.md)

Status: policy preparation only. The active catalog remains 64 operations in 16 workflows and the runtime still uses released `@unifyport/sdk-node` `0.1.3`. This change does not expose new tools, upgrade dependencies, publish packages or claim 78-operation runtime parity.

## Candidate workflows

Every operation below remains unavailable, even when write/destructive opt-ins are enabled. Offline tests lock that boundary before any SDK method can run. A released public SDK, an explicit workflow, field classifications and approval/secure-channel tests are required before activation.

| Candidate operations                                                                | Proposed workflow     | Required review                                                                                                                                                            |
| ----------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getAccountOperation`                                                               | Account lifecycle     | Operation state is not deletion/refund completion; bounded polling, no automatic resubmission.                                                                             |
| `createAccountAuthSession`, `submitAccountPasskeyResponse`, `confirmAccountPasskey` | Account authorization | Explicit write approval; protected response/credential input via references; login URLs and authorization material only through a secure sink.                             |
| `createContact`, `getContactMembership`                                             | Contact directory     | Write confirmation for creation; phone/username/identity data classified; no implicit retries.                                                                             |
| `requestConversationHistory`                                                        | Conversation history  | Write confirmation; asynchronous best-effort events are not a complete archive or guaranteed replay.                                                                       |
| `listPosts`, `getPost`, `listPostComments`, `replyPostComment`                      | Posts and comments    | Separate reads from reply writes; classify comment text/author data; preserve reviewed retry policy even for POST reads.                                                   |
| `createCall`, `getActiveCall`, `hangupCall`                                         | Calls                 | Server eligibility plus explicit runtime controls; create is a write, hangup is destructive; short-lived join URLs require a secure sink. No automatic dialing or retries. |

## Existing field migration

Review wallet fields and optional legacy quotas, account creation idempotency and `202`/`204` deletion, isolated `auth_mode` changes, QR/Passkey state, provider-specific session imports and read boundaries. The optional numeric error code is filtered metadata and must not expose upstream details.

Review 24 event names separately from 40 specialized payload declarations. Preserve sparse updates, explicit false/zero/empty values, poll withdrawals and terminal call state across reordering. New fields fail closed until classified; accepting a webhook does not prove receiver persistence.

## Activation gate

1. Select a released public SDK version and verify the installed package contents; an unpublished source checkout is insufficient for this runtime.
2. Update the canonical capability and data-classification files, then regenerate Skills, policies, schemas and host adapters together.
3. Test approval binding, write/destructive opt-ins, secret references, secure output reservation/commit/abort, redaction, pagination, idempotency and no-retry behavior.
4. Run `pnpm check` and installed-package verification. Prepare a separate review before any release or external write.

## Facebook candidate support

Facebook is a candidate provider for the existing operations, not a new workflow or a released capability of this runtime. The installed SDK stays at `0.1.3`; its input schema must continue to reject `provider=facebook`, even for read tools, until a released SDK and field policies are reviewed. Do not bypass validation with a raw request or activate source-only methods.

Before activation, review session-only account creation/import, separate authorization and running readiness, synchronized E2EE direct conversations, one text/media message per send, and provider-specific unsupported options. Session URLs and materials use secret references; public profile/identity data and media URLs need reviewed projections and secure output policies. Unknown writes are never automatically retried.

Review the four standard callbacks independently: received messages may be inbound or outbound; ordinary runtime error must not revoke authorization. Preserve string IDs, sparse media, explicit false/zero and UTC precision. Native media duration has no confirmed public unit. Adding a provider enum does not authorize groups, contacts, posts/comments, calls, quoted sends, caption or mentions. Receiver support and real-account delivery are separate acceptance steps.
