import type { Tool } from "@modelcontextprotocol/sdk/types.js";
import {
  closeInputSchema,
  operationPolicies,
  type AgentRuntime,
  type OperationApproval,
  type OperationCall,
  type OperationPolicy,
  type SafeOperationResult
} from "@unifyport/agent-core";

interface RegisteredTool {
  readonly definition: Tool;
  readonly policy: OperationPolicy;
}

export interface ToolRegistry {
  readonly definitions: readonly Tool[];
  readonly registrations: ReadonlyMap<string, RegisteredTool>;
  readonly invoke: (
    name: string,
    input: Readonly<Record<string, unknown>>,
    signal: AbortSignal
  ) => Promise<SafeOperationResult>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function approvalSchema(policy: OperationPolicy): Readonly<Record<string, unknown>> {
  const properties: Record<string, unknown> = {
    operationId: { type: "string", const: policy.operationId },
    acknowledged: { type: "boolean", const: true }
  };
  const required = ["operationId", "acknowledged"];
  if (policy.confirmation === "confirm" || policy.confirmation === "double_confirm") {
    properties["requestDigest"] = { type: "string", pattern: "^[a-f0-9]{64}$" };
    required.push("requestDigest");
  }
  if (policy.confirmation === "double_confirm") {
    properties["riskAccepted"] = { type: "boolean", const: true };
    required.push("riskAccepted");
  }
  return { type: "object", additionalProperties: false, properties, required };
}

function secretRefsSchema(policy: OperationPolicy): Readonly<Record<string, unknown>> {
  return {
    type: "object",
    additionalProperties: false,
    properties: Object.fromEntries(
      policy.data.inputs.map((entry) => [
        entry.pointer,
        { type: "string", pattern: "^env:UNIFYPORT_SECRET_[A-Z0-9_]+$" }
      ])
    ),
    required: policy.data.inputs.filter((entry) => entry.required).map((entry) => entry.pointer)
  };
}

function toolInputSchema(
  policy: OperationPolicy,
  schema: Readonly<Record<string, unknown>>
): Tool["inputSchema"] {
  const closed = closeInputSchema(schema);
  if (closed["type"] !== "object") throw new Error("Operation input schema root must be an object");
  const rawProperties = closed["properties"];
  if (rawProperties !== undefined && !isRecord(rawProperties)) {
    throw new Error("Operation input properties must be an object");
  }
  const properties: Record<string, object> = {};
  if (isRecord(rawProperties)) {
    for (const [name, child] of Object.entries(rawProperties)) {
      if (!isRecord(child)) throw new Error(`Operation input property must be an object: ${name}`);
      properties[name] = child;
    }
  }
  if (policy.data.inputs.length > 0) properties["secret_refs"] = secretRefsSchema(policy);
  if (policy.confirmation !== "none") properties["approval"] = approvalSchema(policy);
  const rawRequired = closed["required"];
  const required = Array.isArray(rawRequired)
    ? rawRequired.filter((value): value is string => typeof value === "string")
    : [];
  if (policy.data.inputs.some((entry) => entry.required)) required.push("secret_refs");
  if (policy.confirmation !== "none") required.push("approval");
  return { ...closed, type: "object", properties, additionalProperties: false, required };
}

function parseSecretRefs(value: unknown): Readonly<Record<string, string>> | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) throw new Error("secret_refs must be an object");
  const result: Record<string, string> = {};
  for (const [pointer, reference] of Object.entries(value)) {
    if (typeof reference !== "string") throw new Error("secret_refs values must be strings");
    result[pointer] = reference;
  }
  return result;
}

function parseApproval(value: unknown): OperationApproval | undefined {
  if (value === undefined) return undefined;
  if (
    !isRecord(value) ||
    typeof value["operationId"] !== "string" ||
    value["acknowledged"] !== true
  ) {
    throw new Error("approval is invalid");
  }
  return {
    operationId: value["operationId"],
    acknowledged: true,
    ...(typeof value["requestDigest"] === "string"
      ? { requestDigest: value["requestDigest"] }
      : {}),
    ...(value["riskAccepted"] === true ? { riskAccepted: true } : {})
  };
}

export function createToolRegistry(runtime: AgentRuntime): ToolRegistry {
  const registrations = new Map<string, RegisteredTool>();
  for (const operation of runtime.listOperations()) {
    // SDK 的 MCP policy 是模型工具面的上游硬边界；64/64 Skill 覆盖不代表 64 个工具都可暴露。
    if (
      operation.metadata.mcpExposure === "never" ||
      !runtime.isEnabled(operation.policy.operationId)
    ) {
      continue;
    }
    const policy = operation.policy;
    const definition: Tool = {
      name: policy.toolName,
      title: operation.metadata.summary,
      description: `${policy.workflowId}: ${policy.operationId}. API key is supplied out of band.`,
      inputSchema: toolInputSchema(policy, operation.metadata.inputSchema),
      outputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          data: {},
          meta: {
            type: "object",
            additionalProperties: false,
            properties: { status: { type: "number" }, requestId: { type: "string" } },
            required: ["status"]
          },
          secureReceipts: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { sink: { type: "string" }, fields: { type: "number" } },
              required: ["sink", "fields"]
            }
          }
        },
        required: ["data", "meta"]
      },
      annotations: {
        readOnlyHint: policy.access === "read",
        destructiveHint: policy.access === "destructive",
        idempotentHint: policy.retryable,
        openWorldHint: true
      }
    };
    registrations.set(policy.toolName, { definition, policy });
  }
  const definitions = [...registrations.values()]
    .map((registration) => registration.definition)
    .sort((left, right) => left.name.localeCompare(right.name));
  return {
    definitions,
    registrations,
    invoke: async (name, input, signal): Promise<SafeOperationResult> => {
      const registration = registrations.get(name);
      if (registration === undefined) throw new Error("Unknown tool");
      const request: Record<string, unknown> = { ...input };
      const secretRefs = parseSecretRefs(request["secret_refs"]);
      const approval = parseApproval(request["approval"]);
      delete request["secret_refs"];
      delete request["approval"];
      const call: OperationCall = {
        request,
        ...(secretRefs === undefined ? {} : { secretRefs }),
        ...(approval === undefined ? {} : { approval })
      };
      return await runtime.invoke(registration.policy.operationId, call, signal);
    }
  };
}

export function policySummary(runtime: AgentRuntime): Readonly<Record<string, unknown>> {
  const values = Object.values(operationPolicies);
  return {
    operations: values.length,
    read: values.filter((entry) => entry.access === "read").length,
    write: values.filter((entry) => entry.access === "write").length,
    destructive: values.filter((entry) => entry.access === "destructive").length,
    mcpExposed: runtime.listOperations().filter((entry) => entry.metadata.mcpExposure !== "never")
      .length,
    secureChannel: values.filter(
      (entry) => entry.channel === "secure_input" || entry.channel.includes("secure_output")
    ).length
  };
}
