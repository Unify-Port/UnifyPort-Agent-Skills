/* eslint-disable @typescript-eslint/no-deprecated -- 动态 JSON Schema 需要低层 MCP Server API。 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import type {
  CallToolResult,
  ListResourcesResult,
  ListToolsResult,
  ReadResourceResult,
  Resource
} from "@modelcontextprotocol/sdk/types.js";
import { PublicRuntimeError, type AgentRuntime } from "@unifyport/agent-core";

import { createToolRegistry, policySummary, type ToolRegistry } from "./registry.js";

interface ResourceEntry {
  readonly definition: Resource;
  readonly text: string;
}

export interface McpServerBundle {
  readonly server: Server;
  readonly registry: ToolRegistry;
  readonly resources: readonly Resource[];
}

function resourceEntry(
  uri: string,
  name: string,
  description: string,
  value: unknown
): ResourceEntry {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  return {
    definition: {
      uri,
      name,
      title: name,
      description,
      mimeType: "application/json",
      size: Buffer.byteLength(text, "utf8"),
      annotations: { audience: ["assistant"], priority: 0.8 }
    },
    text
  };
}

function safeToolError(error: unknown): string {
  if (!(error instanceof PublicRuntimeError)) return "UNEXPECTED_ERROR";
  const status = error.status === undefined ? "" : ` HTTP_${String(error.status)}`;
  const requestId = error.requestId === undefined ? "" : ` request_id=${error.requestId}`;
  return `${error.code}${status}${requestId}`;
}

function toolError(message: string): CallToolResult {
  return { content: [{ type: "text", text: message }], isError: true };
}

export function createMcpServer(runtime: AgentRuntime): McpServerBundle {
  const registry = createToolRegistry(runtime);
  const resourceEntries = [
    resourceEntry(
      "unifyport://metadata/capabilities",
      "capabilities",
      "Public capability counts and risk classes; contains no credentials or customer data.",
      policySummary(runtime)
    ),
    resourceEntry(
      "unifyport://metadata/runtime-policy",
      "runtime-policy",
      "Effective permission summary; contains no base URL or secret.",
      {
        permissions: runtime.listOperations().reduce<Record<string, number>>(
          (summary, operation) => ({
            ...summary,
            [operation.policy.access]: (summary[operation.policy.access] ?? 0) + 1
          }),
          {}
        ),
        exposedTools: registry.definitions.length
      }
    )
  ];
  const resourceMap = new Map(resourceEntries.map((entry) => [entry.definition.uri, entry]));
  const server = new Server(
    { name: "unifyport-agent-skills", version: "0.1.0" },
    {
      capabilities: {
        tools: { listChanged: false },
        resources: { subscribe: false, listChanged: false }
      },
      instructions:
        "Use only listed UnifyPort tools. Credentials are out of band; protected fields require secure references or sinks."
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, (): ListToolsResult => ({
    tools: [...registry.definitions]
  }));
  server.setRequestHandler(
    CallToolRequestSchema,
    async (request, extra): Promise<CallToolResult> => {
      if (!registry.registrations.has(request.params.name)) {
        throw new McpError(ErrorCode.InvalidParams, "Unknown public tool");
      }
      try {
        const result = await registry.invoke(
          request.params.name,
          request.params.arguments ?? {},
          extra.signal
        );
        const structuredContent: Record<string, unknown> = { ...result };
        return {
          content: [{ type: "text", text: "UnifyPort operation completed with a safe result." }],
          structuredContent
        };
      } catch (error) {
        // stdout 只承载 JSON-RPC；stderr 也只记录安全错误分类，不展开 cause 或 payload。
        const code = error instanceof PublicRuntimeError ? error.code : "UNEXPECTED_ERROR";
        console.error(`[mcp] tool failed code=${code}`);
        return toolError(safeToolError(error));
      }
    }
  );
  server.setRequestHandler(ListResourcesRequestSchema, (): ListResourcesResult => ({
    resources: resourceEntries.map((entry) => entry.definition)
  }));
  server.setRequestHandler(ReadResourceRequestSchema, (request): ReadResourceResult => {
    const entry = resourceMap.get(request.params.uri);
    if (entry === undefined) throw new McpError(ErrorCode.InvalidParams, "Unknown public resource");
    return {
      contents: [
        { uri: entry.definition.uri, mimeType: entry.definition.mimeType, text: entry.text }
      ]
    };
  });
  server.onerror = (error): void => {
    const kind = error instanceof Error ? error.name : "UnknownError";
    // 协议错误可能回显非法输入，日志只保留错误类型。
    console.error(`[mcp] protocol error kind=${kind}`);
  };
  return {
    server,
    registry,
    resources: resourceEntries.map((entry) => entry.definition)
  };
}
