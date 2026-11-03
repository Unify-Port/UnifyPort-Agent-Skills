import { safeRuntimeError } from "../src/errors.js";
import { UnifyPortApiError } from "@unifyport/sdk-node";
import { deviceOperations } from "@unifyport/sdk-node";
import { describe, expect, it, vi } from "vitest";
import { AgentRuntime } from "../src/runtime.js";
import { closeInputSchema, projectOutput } from "../src/projection.js";
import { requestDigest } from "../src/json.js";
import type { OperationCall, RuntimeConfig, SecureSink } from "../src/types.js";

const config: RuntimeConfig = {
  baseUrl: "https://api.unifyport.ai",
  apiKey: () => "<api-key>",
  permissions: { enableWrites: true, enableDestructive: true },
  timeoutMs: 30000,
  maxInputBytes: 256 * 1024,
  maxOutputBytes: 1024 * 1024
};
const path = { path: { account_id: "acc_example" } };
// 每个新操作使用合法输入，验证的是权限、确认和安全通道，而非仅测试目录存在。
const cases: readonly [string, Record<string, unknown>, Record<string, string>?][] = [
  ["getAccountOperation", { params: { path: { operation_id: "op_example" } } }],
  ["createAccountAuthSession", { params: path }],
  [
    "submitAccountPasskeyResponse",
    { params: path },
    { "/body/webauthn_response": "env:UNIFYPORT_SECRET_PASSKEY" }
  ],
  ["confirmAccountPasskey", { params: path }],
  ["createContact", { params: path, body: { phone_number: "<phone>" } }],
  ["getContactMembership", { params: { ...path, query: { contact_id: "contact_example" } } }],
  [
    "requestConversationHistory",
    {
      params: path,
      body: {
        conversation_id: "9007199254740993@lid",
        before: {
          message_id: "message_example",
          sent_at: "2026-11-03T01:02:03.123456789Z",
          direction: "inbound"
        }
      }
    }
  ],
  ["listPosts", { params: path }],
  ["getPost", { params: path, body: { post_id: "post_example" } }],
  ["listPostComments", { params: path, body: { post_id: "post_example" } }],
  ["replyPostComment", { params: path, body: { post_id: "post_example", text: "Example" } }],
  [
    "createCall",
    {
      body: {
        account_id: "acc_example",
        to: { id: "user_example", type: "user" },
        media_type: "voice"
      }
    }
  ],
  ["getActiveCall", { params: { query: { account_id: "acc_example" } } }],
  [
    "hangupCall",
    { params: { path: { call_id: "call_example" } }, body: { account_id: "acc_example" } }
  ]
];
function approved(
  id: string,
  request: Record<string, unknown>,
  secretRefs?: Record<string, string>
): OperationCall {
  return {
    request,
    ...(secretRefs === undefined ? {} : { secretRefs }),
    approval: {
      operationId: id,
      acknowledged: true,
      riskAccepted: true,
      requestDigest: requestDigest(id, request, secretRefs)
    }
  };
}
const sink: SecureSink = {
  reserve: async () => ({
    commit: async (values) => ({ sink: "test", fields: Object.keys(values).length }),
    abort: async () => undefined
  })
};

describe("released SDK operation compatibility", () => {
  it.each(cases)(
    "executes reviewed %s without automatic retry",
    async (id, request, secretRefs) => {
      const invoke = vi.fn(async (request: unknown, options: unknown) => {
        void request;
        void options;
        return { data: { data: {} }, status: 200 };
      });
      const runtime = new AgentRuntime({
        config,
        client: { [id]: invoke },
        secureSink: sink,
        secretResolver: { resolve: async () => '{"id":"credential_example"}' }
      });
      const policy = runtime
        .listOperations()
        .find((entry) => entry.policy.operationId === id)?.policy;
      if (policy?.access !== "read") {
        await expect(runtime.invoke(id, { request })).rejects.toMatchObject({
          code: "CONFIRMATION_REQUIRED"
        });
      }
      await runtime.invoke(id, approved(id, request, secretRefs));
      expect(invoke).toHaveBeenCalledTimes(1);
      expect(invoke.mock.calls[0]?.[1]).toMatchObject({ retry: false });
    }
  );

  it.each([202, 204])("preserves deletion status %i and legacy empty responses", async (status) => {
    const request = { params: path };
    const runtime = new AgentRuntime({
      config,
      client: {
        deleteAccount: async () => ({
          status,
          data: status === 204 ? null : { data: { operation_id: "op_example", state: "PENDING" } }
        })
      }
    });
    const result = await runtime.invoke("deleteAccount", approved("deleteAccount", request));
    expect(result.meta.status).toBe(status);
    if (status === 204) expect(result.data).toBeNull();
    else expect(JSON.stringify(result.data)).toContain("op_example");
  });

  it("preserves paging and caller idempotency while keeping profiles outside model context", async () => {
    const list = vi.fn(async () => ({
      status: 200,
      data: {
        data: {
          items: [
            { id: "acc_example", provider: "facebook", provider_profile: { cookie: "hidden" } }
          ],
          has_more: false,
          next_cursor: ""
        }
      }
    }));
    const create = vi.fn(async (request: unknown) => {
      void request;
      return {
        status: 201,
        data: { data: { id: "acc_example", provider_profile: { cookie: "hidden" } } }
      };
    });
    const runtime = new AgentRuntime({
      config,
      client: { listAccounts: list, createAccount: create },
      secureSink: sink,
      secretResolver: { resolve: async () => '{"api_id":"example","api_hash":"protected"}' }
    });
    const page = await runtime.invoke("listAccounts", {
      request: { params: { query: { limit: 1, cursor: "opaque_cursor" } } }
    });
    expect(JSON.stringify(page)).toContain('"has_more":false');
    expect(JSON.stringify(page)).not.toContain("hidden");
    const request = {
      params: { header: { "Idempotency-Key": "creation_example" } },
      body: { provider: "facebook", region: "region_example", auth_mode: "session" }
    };
    const refs = { "/body/provider_data": "env:UNIFYPORT_SECRET_PROVIDER" };
    const result = await runtime.invoke("createAccount", approved("createAccount", request, refs));
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      ...request,
      body: { ...request.body, provider_data: { api_id: "example", api_hash: "protected" } }
    });
    expect(JSON.stringify(result)).not.toContain("hidden");
    await expect(
      runtime.invoke(
        "createAccount",
        approved("createAccount", { body: { ...request.body, auth_mode: "qrcode" } })
      )
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
  });

  it("does not leak malformed JSON references or execute after decoding fails", async () => {
    const create = vi.fn();
    const runtime = new AgentRuntime({
      config,
      client: { createAccount: create },
      secureSink: sink,
      secretResolver: { resolve: async () => "private invalid JSON" }
    });
    const request = {
      body: { provider: "facebook", region: "region_example", auth_mode: "session" }
    };
    await expect(
      runtime.invoke(
        "createAccount",
        approved("createAccount", request, { "/body/proxy": "env:UNIFYPORT_SECRET_PROXY" })
      )
    ).rejects.toMatchObject({
      code: "INVALID_SECRET",
      message: "Referenced secret must contain JSON"
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("preserves enum state but excludes arbitrary OAuth state", () => {
    const output = projectOutput(
      {
        data: {
          data: {
            operation_id: "op_example",
            kind: "DELETE",
            state: "PENDING",
            last_error_code: "cleanup_unconfirmed"
          }
        },
        meta: { status: 200 }
      },
      deviceOperations.getAccountOperation.outputSchema
    );
    expect(JSON.stringify(output)).toContain("PENDING");
    expect(
      projectOutput(
        { state: "private" },
        { type: "object", properties: { state: { type: "string" } } }
      )
    ).toEqual({});
  });

  it("keeps conditional schemas outside model tools and validates them in runtime", async () => {
    expect(() => closeInputSchema(deviceOperations.sendMessage.inputSchema)).toThrow(
      "requires explicit support"
    );
    const sendMessage = vi.fn(async () => ({
      status: 200,
      data: { data: { reply_token: "private_reply" } }
    }));
    const runtime = new AgentRuntime({ config, client: { sendMessage }, secureSink: sink });
    const body = {
      account_id: "acc_example",
      to: { id: "9007199254740993", type: "user" },
      message: { type: "text", text: "Example" }
    };
    const result = await runtime.invoke("sendMessage", approved("sendMessage", { body }));
    expect(JSON.stringify(result)).not.toContain("private_reply");
    await expect(
      runtime.invoke(
        "sendMessage",
        approved("sendMessage", { body: { ...body, message: { ...body.message, poll: {} } } })
      )
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect(sendMessage).toHaveBeenCalledTimes(1);
  });
});

// 兼容旧错误缺失数字码；非法分类也不能成为携带敏感信息的新输出通道。
it.each([undefined, "30017", "private_error", "123456"])(
  "filters numeric error classification %s",
  (numericCode) => {
    const error = safeRuntimeError(
      new UnifyPortApiError("private_message", {
        status: 429,
        requestId: undefined,
        code: "provider_rate_limited",
        ...(numericCode === undefined ? {} : { numericCode }),
        details: { cookie: "private_cookie" }
      })
    );
    expect(error.numericCode).toBe(numericCode === "30017" ? numericCode : undefined);
    expect(JSON.stringify(error)).not.toContain("private_cookie");
    expect(error.message).not.toContain("private_message");
  }
);

// 查询操作的错误分类和通话终态必须可见，否则调用方无法做异步核对。
it("preserves declared operation error codes and terminal call states", () => {
  const operation = projectOutput(
    {
      data: {
        data: {
          operation_id: "op_example",
          kind: "DELETE",
          state: "REVIEW",
          last_error_code: "cleanup_unconfirmed"
        }
      },
      meta: { status: 200 }
    },
    deviceOperations.getAccountOperation.outputSchema
  );
  expect(JSON.stringify(operation)).toContain("cleanup_unconfirmed");
  const call = projectOutput(
    {
      data: {
        data: {
          call_id: "call_example",
          state: "ended",
          direction: "outbound",
          media_type: "voice"
        }
      },
      meta: { status: 200 }
    },
    deviceOperations.hangupCall.outputSchema
  );
  expect(JSON.stringify(call)).toContain('"state":"ended"');
  const workspace = projectOutput(
    {
      data: { data: { name: "Example", is_beta: false, account_quota_used: 0 } },
      meta: { status: 200 }
    },
    deviceOperations.getWorkspace.outputSchema
  );
  expect(JSON.stringify(workspace)).toContain('"is_beta":false');
  expect(JSON.stringify(workspace)).toContain('"account_quota_used":0');
});
