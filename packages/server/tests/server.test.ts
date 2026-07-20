import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { AgentRuntime, type RuntimeConfig } from "@unifyport/agent-core";
import { describe, expect, it } from "vitest";

import { createGateway, gatewayConfigFromEnvironment } from "../src/gateway.js";
import { createToolRegistry } from "../src/registry.js";
import { createMcpServer } from "../src/server.js";

function config(enableWrites = false): RuntimeConfig {
  return {
    baseUrl: "https://api.unifyport.ai",
    apiKey: () => "<api-key>",
    permissions: { enableWrites, enableDestructive: false },
    timeoutMs: 30_000,
    maxInputBytes: 256 * 1024,
    maxOutputBytes: 1024 * 1024
  };
}

describe("MCP registry", () => {
  it("inherits the released SDK allowlist and defaults to read-only", () => {
    const readOnly = createToolRegistry(new AgentRuntime({ config: config(), client: {} }));
    expect(readOnly.definitions.map((tool) => tool.name)).toEqual([
      "device_get_workspace",
      "device_list_api_keys",
      "device_list_provider_regions"
    ]);

    const writes = createToolRegistry(new AgentRuntime({ config: config(true), client: {} }));
    expect(writes.definitions.map((tool) => tool.name)).toEqual([
      "device_get_workspace",
      "device_list_api_keys",
      "device_list_provider_regions",
      "device_update_api_key_status"
    ]);
    expect(writes.definitions).toHaveLength(4);
  });

  it("serves a safe structured result over a real in-memory MCP transport", async () => {
    const runtime = new AgentRuntime({
      config: config(),
      client: {
        getWorkspace: async () => ({
          data: { data: { name: "Example Workspace", status: "active" } },
          status: 200,
          requestId: "req_example"
        })
      }
    });
    const { server } = createMcpServer(runtime);
    const client = new Client({ name: "test-client", version: "1.0.0" });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(3);
      const result = await client.callTool({ name: "device_get_workspace", arguments: {} });
      expect(result.isError).not.toBe(true);
      expect(JSON.stringify(result.structuredContent)).toContain("Example Workspace");
    } finally {
      await client.close();
      await server.close();
    }
  });
});

describe("remote gateway configuration", () => {
  it("binds to loopback by default and rejects an unapproved public bind", () => {
    expect(gatewayConfigFromEnvironment({})).toMatchObject({
      host: "127.0.0.1",
      port: 8787,
      publicMode: false
    });
    expect(() => gatewayConfigFromEnvironment({ UNIFYPORT_GATEWAY_HOST: "0.0.0.0" })).toThrow(
      "UNIFYPORT_GATEWAY_PUBLIC=true"
    );
    expect(() =>
      gatewayConfigFromEnvironment({
        UNIFYPORT_GATEWAY_HOST: "0.0.0.0",
        UNIFYPORT_GATEWAY_PUBLIC: "true"
      })
    ).toThrow("explicit host allowlist");
    expect(() =>
      gatewayConfigFromEnvironment({
        UNIFYPORT_GATEWAY_HOST: "0.0.0.0",
        UNIFYPORT_GATEWAY_PUBLIC: "true",
        UNIFYPORT_GATEWAY_ALLOWED_HOSTS: "gateway.example.invalid"
      })
    ).toThrow("TLS certificate and key");
    expect(
      gatewayConfigFromEnvironment({
        UNIFYPORT_GATEWAY_HOST: "0.0.0.0",
        UNIFYPORT_GATEWAY_PUBLIC: "true",
        UNIFYPORT_GATEWAY_ALLOWED_HOSTS: "gateway.example.invalid",
        UNIFYPORT_GATEWAY_TLS_CERT_FILE: "certificate.pem",
        UNIFYPORT_GATEWAY_TLS_KEY_FILE: "private-key.pem"
      })
    ).toMatchObject({
      publicMode: true,
      tlsCertificateFile: "certificate.pem",
      tlsKeyFile: "private-key.pem"
    });
    // 即使 library caller 构造了矛盾 config，明文 server 也不能接受非 loopback host。
    expect(() =>
      createGateway({
        host: "0.0.0.0",
        port: 8787,
        allowedHosts: new Set(),
        allowedOrigins: new Set(),
        publicMode: false
      })
    ).toThrow("TLS server entry point");
  });

  it("authenticates and lists the approved tools over Streamable HTTP", async () => {
    const gateway = createGateway(
      {
        host: "127.0.0.1",
        port: 0,
        allowedHosts: new Set(),
        allowedOrigins: new Set(),
        publicMode: false
      },
      {},
      () =>
        new AgentRuntime({
          config: config(),
          client: {
            getWorkspace: async () => ({
              data: { data: { name: "Example Workspace", status: "active" } },
              status: 200,
              requestId: "req_example"
            })
          }
        })
    );
    await new Promise<void>((resolve, reject) => {
      gateway.once("error", reject);
      gateway.listen(0, "127.0.0.1", resolve);
    });
    const address = gateway.address();
    if (address === null || typeof address === "string") throw new Error("Expected a TCP address");
    const endpoint = new URL(`http://127.0.0.1:${String(address.port)}/mcp`);
    const openApiResponse = await fetch(new URL("/openapi.json", endpoint));
    expect(openApiResponse.status).toBe(200);
    const openApiDocument = (await openApiResponse.json()) as {
      readonly openapi: string;
      readonly paths: Readonly<Record<string, unknown>>;
    };
    expect(openApiDocument.openapi).toBe("3.1.0");
    expect(Object.keys(openApiDocument.paths)).toEqual([
      "/tools/device_get_workspace",
      "/tools/device_list_api_keys",
      "/tools/device_list_provider_regions"
    ]);
    // 鉴权与来源拒绝响应只能返回稳定 code，避免 credential 或请求内容进入诊断。
    const unauthorized = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })
    });
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({ error: { code: "AUTH_REQUIRED" } });
    const disallowedOrigin = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: "Bearer <api-key>",
        "Content-Type": "application/json",
        Origin: "https://example.invalid"
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} })
    });
    expect(disallowedOrigin.status).toBe(403);
    expect(await disallowedOrigin.text()).not.toContain("<api-key>");
    // OpenAPI facade 复用同一 registry 和投影结果，不能成为绕过 MCP allowlist 的第二套实现。
    const toolResponse = await fetch(new URL("/tools/device_get_workspace", endpoint), {
      method: "POST",
      headers: { Authorization: "Bearer <api-key>", "Content-Type": "application/json" },
      body: "{}"
    });
    expect(toolResponse.status).toBe(200);
    const toolResult = await toolResponse.text();
    expect(toolResult).toContain("Example Workspace");
    expect(toolResult).not.toContain("<api-key>");
    const unknownTool = await fetch(new URL("/tools/device_not_available", endpoint), {
      method: "POST",
      headers: { Authorization: "Bearer <api-key>", "Content-Type": "application/json" },
      body: "{}"
    });
    expect(unknownTool.status).toBe(404);
    const client = new Client({ name: "http-test-client", version: "1.0.0" });
    const transport = new StreamableHTTPClientTransport(endpoint, {
      requestInit: { headers: { Authorization: "Bearer <api-key>" } }
    });
    try {
      await client.connect(transport);
      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(3);
    } finally {
      await client.close().catch(() => undefined);
      await new Promise<void>((resolve, reject) => {
        gateway.close((error) => {
          if (error === undefined) resolve();
          else reject(error);
        });
      });
    }
  });
});
