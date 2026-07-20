import { describe, expect, it, vi } from "vitest";

import { AgentRuntime } from "../src/runtime.js";
import { configFromEnvironment } from "../src/config.js";
import { requestDigest } from "../src/json.js";
import type {
  RuntimeConfig,
  SecureOutputReservation,
  SecureReceipt,
  SecureSink
} from "../src/types.js";

function config(
  permissions: { readonly enableWrites: boolean; readonly enableDestructive: boolean } = {
    enableWrites: false,
    enableDestructive: false
  }
): RuntimeConfig {
  return {
    baseUrl: "https://api.unifyport.ai",
    apiKey: () => "<api-key>",
    permissions,
    timeoutMs: 30_000,
    maxInputBytes: 256 * 1024,
    maxOutputBytes: 1024 * 1024
  };
}

class CaptureSink implements SecureSink {
  public captured: Readonly<Record<string, unknown>> | undefined;

  public async reserve(): Promise<SecureOutputReservation> {
    return {
      commit: async (values): Promise<SecureReceipt> => {
        this.captured = values;
        return { sink: "test", fields: Object.keys(values).length };
      },
      abort: async (): Promise<void> => undefined
    };
  }
}

describe("configFromEnvironment", () => {
  it("requires an out-of-band API key and expands permissions only for exact true", () => {
    expect(() => configFromEnvironment({})).toThrow("UNIFYPORT_API_KEY is required");
    const runtimeConfig = configFromEnvironment({
      UNIFYPORT_API_KEY: "<api-key>",
      UNIFYPORT_ALLOW_WRITES: "TRUE",
      UNIFYPORT_ALLOW_DESTRUCTIVE: "true"
    });
    expect(runtimeConfig.permissions).toEqual({ enableWrites: false, enableDestructive: false });
  });
});

describe("AgentRuntime", () => {
  it("keeps the 64-operation public catalog complete", () => {
    const runtime = new AgentRuntime({ config: config(), client: {} });
    expect(runtime.listOperations()).toHaveLength(64);
    expect(new Set(runtime.listOperations().map((entry) => entry.policy.workflowId)).size).toBe(16);
  });

  it("projects declared output and removes unknown or sensitive fields", async () => {
    const runtime = new AgentRuntime({
      config: config(),
      client: {
        getWorkspace: async () => ({
          data: {
            request_id: "req_example",
            data: { name: "Example Workspace", status: "active", api_key: "not-returned" },
            unexpected: "not-returned"
          },
          status: 200,
          requestId: "req_example"
        })
      }
    });
    const result = await runtime.invoke("getWorkspace", { request: {} });
    const serialized = JSON.stringify(result);
    expect(serialized).toContain("Example Workspace");
    expect(serialized).not.toContain("not-returned");
    expect(result.meta).toEqual({ status: 200, requestId: "req_example" });
  });

  it("injects protected input only from an approved secret reference", async () => {
    const invoked = vi.fn(async (request: unknown) => {
      void request;
      return { data: { data: {} }, status: 200 };
    });
    const runtime = new AgentRuntime({
      config: config({ enableWrites: true, enableDestructive: false }),
      client: { submitAccountAuthCode: invoked },
      secretResolver: {
        resolve: async (reference) =>
          reference === "env:UNIFYPORT_SECRET_AUTH_CODE" ? "654321" : undefined
      }
    });
    await runtime.invoke("submitAccountAuthCode", {
      request: { params: { path: { account_id: "acc_example" } } },
      secretRefs: { "/body/code": "env:UNIFYPORT_SECRET_AUTH_CODE" },
      approval: { operationId: "submitAccountAuthCode", acknowledged: true }
    });
    expect(invoked).toHaveBeenCalledTimes(1);
    expect(invoked.mock.calls[0]?.[0]).toEqual({
      params: { path: { account_id: "acc_example" } },
      body: { code: "654321" }
    });
  });

  it("rejects a protected value supplied directly by the model", async () => {
    const runtime = new AgentRuntime({
      config: config({ enableWrites: true, enableDestructive: false }),
      client: { submitAccountAuthCode: vi.fn() }
    });
    await expect(
      runtime.invoke("submitAccountAuthCode", {
        request: {
          params: { path: { account_id: "acc_example" } },
          body: { code: "654321" }
        },
        approval: { operationId: "submitAccountAuthCode", acknowledged: true }
      })
    ).rejects.toMatchObject({ code: "DIRECT_SECRET_DENIED" });
  });

  it("reserves the secure sink before creating a one-time secret", async () => {
    const createApiKey = vi.fn();
    const request = { body: { name: "Example key" } };
    const runtime = new AgentRuntime({
      config: config({ enableWrites: true, enableDestructive: false }),
      client: { createApiKey }
    });
    await expect(
      runtime.invoke("createApiKey", {
        request,
        approval: {
          operationId: "createApiKey",
          acknowledged: true,
          requestDigest: requestDigest("createApiKey", request)
        }
      })
    ).rejects.toMatchObject({ code: "SECURE_SINK_REQUIRED" });
    expect(createApiKey).not.toHaveBeenCalled();
  });

  it("stores one-time output outside model context and returns only a receipt", async () => {
    const sink = new CaptureSink();
    const request = { body: { name: "Example key" } };
    const runtime = new AgentRuntime({
      config: config({ enableWrites: true, enableDestructive: false }),
      client: {
        createApiKey: async () => ({
          data: {
            request_id: "req_example",
            data: {
              key: {
                id: "ak_example",
                name: "Example key",
                key_prefix: "up_example",
                status: "active"
              },
              api_key: "one-time-value"
            }
          },
          status: 201,
          requestId: "req_example"
        })
      },
      secureSink: sink
    });
    const result = await runtime.invoke("createApiKey", {
      request,
      approval: {
        operationId: "createApiKey",
        acknowledged: true,
        requestDigest: requestDigest("createApiKey", request)
      }
    });
    expect(sink.captured).toEqual({ "/data/data/api_key": "one-time-value" });
    expect(JSON.stringify(result)).not.toContain("one-time-value");
    expect(result.secureReceipts).toEqual([{ sink: "test", fields: 1 }]);
  });

  it("keeps writes and destructive operations behind independent switches", async () => {
    const writeRuntime = new AgentRuntime({
      config: config(),
      client: { updateWorkspace: vi.fn() }
    });
    await expect(
      writeRuntime.invoke("updateWorkspace", {
        request: { body: { name: "Example" } },
        approval: { operationId: "updateWorkspace", acknowledged: true }
      })
    ).rejects.toMatchObject({ code: "WRITES_DISABLED" });

    const destructiveRuntime = new AgentRuntime({
      config: config({ enableWrites: true, enableDestructive: false }),
      client: { deleteAccount: vi.fn() }
    });
    await expect(
      destructiveRuntime.invoke("deleteAccount", {
        request: { params: { path: { account_id: "acc_example" } } },
        approval: {
          operationId: "deleteAccount",
          acknowledged: true,
          requestDigest: requestDigest("deleteAccount", {
            params: { path: { account_id: "acc_example" } }
          }),
          riskAccepted: true
        }
      })
    ).rejects.toMatchObject({ code: "DESTRUCTIVE_DISABLED" });
  });

  it("rejects webhook targets that could reach local or private services", async () => {
    // 客户端必须在发起上游写请求前阻断明显 SSRF 目标，服务端校验作为另一层边界。
    const createWebhookEndpoint = vi.fn();
    const request = { body: { url: "https://127.0.0.1/hook", status: "active" } };
    const runtime = new AgentRuntime({
      config: config({ enableWrites: true, enableDestructive: false }),
      client: { createWebhookEndpoint }
    });
    await expect(
      runtime.invoke("createWebhookEndpoint", {
        request,
        approval: {
          operationId: "createWebhookEndpoint",
          acknowledged: true,
          requestDigest: requestDigest("createWebhookEndpoint", request)
        }
      })
    ).rejects.toMatchObject({ code: "WEBHOOK_TARGET_DENIED" });
    expect(createWebhookEndpoint).not.toHaveBeenCalled();
  });
});
