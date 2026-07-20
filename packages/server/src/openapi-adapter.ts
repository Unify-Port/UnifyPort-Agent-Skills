import type { Tool } from "@modelcontextprotocol/sdk/types.js";

import type { ToolRegistry } from "./registry.js";

export const OPENAPI_DOCUMENT_PATH = "/openapi.json";
export const TOOL_PATH_PREFIX = "/tools/";

function toolPath(tool: Tool): string {
  if (!/^[a-z][a-z0-9_]{0,127}$/u.test(tool.name)) {
    throw new Error("OpenAPI adapter tool name is invalid");
  }
  return `${TOOL_PATH_PREFIX}${tool.name}`;
}

export function toolNameFromPath(pathname: string): string | undefined {
  if (!pathname.startsWith(TOOL_PATH_PREFIX)) return undefined;
  const name = pathname.slice(TOOL_PATH_PREFIX.length);
  return /^[a-z][a-z0-9_]{0,127}$/u.test(name) ? name : undefined;
}

export function createOpenApiAdapterDocument(
  registry: ToolRegistry,
  serverUrl: string
): Readonly<Record<string, unknown>> {
  const origin = new URL(serverUrl);
  if (
    origin.pathname !== "/" ||
    origin.search !== "" ||
    origin.hash !== "" ||
    origin.username !== "" ||
    origin.password !== ""
  ) {
    throw new Error("OpenAPI adapter server URL must be an origin");
  }
  if (origin.protocol !== "https:" && origin.protocol !== "http:") {
    throw new Error("OpenAPI adapter server URL must use HTTP or HTTPS");
  }
  const paths = Object.fromEntries(
    registry.definitions.map((tool) => [
      toolPath(tool),
      {
        post: {
          operationId: tool.name,
          summary: tool.title ?? tool.name,
          description: tool.description,
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { "application/json": { schema: tool.inputSchema } }
          },
          responses: {
            "200": {
              description: "Safe projected UnifyPort result.",
              content: { "application/json": { schema: tool.outputSchema ?? {} } }
            },
            default: {
              description: "Stable public error without upstream payload details.",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      error: {
                        type: "object",
                        additionalProperties: false,
                        properties: { code: { type: "string" } },
                        required: ["code"]
                      }
                    },
                    required: ["error"]
                  }
                }
              }
            }
          }
        }
      }
    ])
  );
  // OpenAPI facade 只投影当前 registry，绝不绕过 SDK 的 MCP allowlist。
  return {
    openapi: "3.1.0",
    info: {
      title: "UnifyPort model-safe tools",
      version: "0.1.0",
      description: "OpenAPI facade for the same policy-gated tools exposed by the MCP runtime."
    },
    servers: [{ url: origin.origin }],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "UnifyPort API Key"
        }
      }
    }
  };
}
