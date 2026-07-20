import {
  UnifyPortDeviceClient,
  deviceOperations,
  type OperationMetadata
} from "@unifyport/sdk-node";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";

import { PublicRuntimeError, safeRuntimeError } from "./errors.js";
import { operationPolicies } from "./generated/policy-catalog.js";
import {
  deletePointer,
  getPointer,
  isRecord,
  requestDigest,
  serializedSize,
  setPointer
} from "./json.js";
import { validateNetworkBoundary } from "./network.js";
import { projectInput, projectOutput } from "./projection.js";
import { EnvironmentSecretResolver, UnavailableSecureSink } from "./secure-channel.js";
import type {
  AgentRuntimeOptions,
  OperationCall,
  OperationPolicy,
  OperationPreview,
  PublicOperation,
  SafeOperationResult,
  SecureOutputReservation
} from "./types.js";

const sdkOperations: Readonly<Record<string, OperationMetadata>> = deviceOperations;
const policies: Readonly<Record<string, OperationPolicy>> = operationPolicies;
type OperationMethod = (
  request: Record<string, unknown>,
  options: { readonly signal: AbortSignal | undefined; readonly retry: false }
) => unknown;

function cloneRecord(value: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return structuredClone(value);
}

function validateApproval(policy: OperationPolicy, call: OperationCall): void {
  if (policy.confirmation === "none") return;
  const approval = call.approval;
  if (approval?.operationId !== policy.operationId) {
    throw new PublicRuntimeError("CONFIRMATION_REQUIRED", "Operation confirmation is required");
  }
  if (policy.confirmation === "confirm" || policy.confirmation === "double_confirm") {
    const expected = requestDigest(policy.operationId, call.request, call.secretRefs);
    if (approval.requestDigest !== expected) {
      throw new PublicRuntimeError(
        "CONFIRMATION_STALE",
        "Confirmation does not match this request"
      );
    }
  }
  if (policy.confirmation === "double_confirm" && approval.riskAccepted !== true) {
    throw new PublicRuntimeError(
      "RISK_ACCEPTANCE_REQUIRED",
      "Destructive risk acceptance is required"
    );
  }
}

function validatePermission(policy: OperationPolicy, options: AgentRuntimeOptions): void {
  if (policy.access === "read") return;
  if (!options.config.permissions.enableWrites) {
    throw new PublicRuntimeError("WRITES_DISABLED", "Write operations are disabled");
  }
  if (policy.access === "destructive" && !options.config.permissions.enableDestructive) {
    throw new PublicRuntimeError("DESTRUCTIVE_DISABLED", "Destructive operations are disabled");
  }
}

function normalizedResult(value: unknown): Record<string, unknown> {
  if (!isRecord(value) || typeof value["status"] !== "number" || !("data" in value)) {
    throw new PublicRuntimeError(
      "INVALID_OUTPUT",
      "SDK operation returned an unexpected result shape"
    );
  }
  const requestId = value["requestId"];
  return {
    data: value["data"] ?? null,
    meta: {
      status: value["status"],
      ...(typeof requestId === "string" ? { requestId } : {})
    }
  };
}

export class AgentRuntime {
  readonly #options: AgentRuntimeOptions;
  readonly #client: object;
  readonly #validator: Ajv2020;
  readonly #inputValidators = new Map<string, ValidateFunction<Record<string, unknown>>>();

  public constructor(options: AgentRuntimeOptions) {
    this.#options = options;
    this.#client =
      options.client ??
      new UnifyPortDeviceClient({
        baseUrl: options.config.baseUrl,
        apiKey: options.config.apiKey,
        timeoutMs: options.config.timeoutMs
      });
    // format 仅是 annotation；结构、required、enum 和范围仍由公开 JSON Schema 严格校验。
    this.#validator = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
  }

  public listOperations(): readonly PublicOperation[] {
    return Object.values(policies)
      .map((policy) => {
        const metadata = sdkOperations[policy.operationId];
        if (metadata === undefined) {
          throw new PublicRuntimeError(
            "CATALOG_DRIFT",
            "Public SDK operation catalog is incomplete"
          );
        }
        return { policy, metadata };
      })
      .sort((left, right) => left.policy.operationId.localeCompare(right.policy.operationId));
  }

  public isEnabled(operationId: string): boolean {
    const policy = policies[operationId];
    if (policy === undefined) return false;
    if (policy.access === "read") return true;
    if (!this.#options.config.permissions.enableWrites) return false;
    return policy.access !== "destructive" || this.#options.config.permissions.enableDestructive;
  }

  public preview(operationId: string, call: Omit<OperationCall, "approval">): OperationPreview {
    const operation = this.#operation(operationId);
    serializedSize(call.request, this.#options.config.maxInputBytes, "Operation input");
    return {
      operationId,
      workflowId: operation.policy.workflowId,
      method: operation.policy.method,
      path: operation.policy.path,
      access: operation.policy.access,
      confirmation: operation.policy.confirmation,
      requestDigest: requestDigest(operationId, call.request, call.secretRefs)
    };
  }

  public async invoke(
    operationId: string,
    call: OperationCall,
    signal?: AbortSignal
  ): Promise<SafeOperationResult> {
    const operation = this.#operation(operationId);
    serializedSize(call.request, this.#options.config.maxInputBytes, "Operation input");
    validatePermission(operation.policy, this.#options);
    validateApproval(operation.policy, call);

    let reservation: SecureOutputReservation | undefined;
    try {
      if (operation.policy.data.outputs.length > 0) {
        reservation = await (this.#options.secureSink ?? new UnavailableSecureSink()).reserve(
          operationId,
          operation.policy.data.outputs.map((entry) => entry.pointer)
        );
      }
      const request = await this.#prepareInput(operation, call);
      const method: unknown = Reflect.get(this.#client, operationId);
      if (!isOperationMethod(method)) {
        throw new PublicRuntimeError("CATALOG_DRIFT", "Public SDK method is unavailable");
      }
      // 动态分派只接受固定 catalog 中的函数，避免把任意属性当成 SDK operation 调用。
      const result = normalizedResult(
        await method.call(this.#client, request, { signal, retry: false })
      );
      serializedSize(result, this.#options.config.maxOutputBytes, "Operation output");
      const secrets: Record<string, unknown> = {};
      for (const entry of operation.policy.data.outputs) {
        const secret = deletePointer(result, entry.pointer);
        if (secret !== undefined) secrets[entry.pointer] = secret;
      }
      const projected = projectOutput(result, operation.metadata.outputSchema);
      const receipt = reservation === undefined ? undefined : await reservation.commit(secrets);
      serializedSize(projected, this.#options.config.maxOutputBytes, "Projected output");
      return {
        data: projected["data"] ?? null,
        meta: isRecord(projected["meta"])
          ? {
              status:
                typeof projected["meta"]["status"] === "number" ? projected["meta"]["status"] : 200,
              ...(typeof projected["meta"]["requestId"] === "string"
                ? { requestId: projected["meta"]["requestId"] }
                : {})
            }
          : { status: 200 },
        ...(receipt === undefined ? {} : { secureReceipts: [receipt] })
      };
    } catch (error) {
      if (reservation !== undefined) await reservation.abort();
      throw safeRuntimeError(error);
    }
  }

  #operation(operationId: string): PublicOperation {
    const policy = policies[operationId];
    const metadata = sdkOperations[operationId];
    if (policy === undefined || metadata === undefined) {
      throw new PublicRuntimeError("UNKNOWN_OPERATION", "Unknown public operation");
    }
    return { policy, metadata };
  }

  async #prepareInput(
    operation: PublicOperation,
    call: OperationCall
  ): Promise<Record<string, unknown>> {
    const request = cloneRecord(call.request);
    const secretRefs = call.secretRefs ?? {};
    const allowedPointers = new Map(
      operation.policy.data.inputs.map((entry) => [entry.pointer, entry])
    );
    for (const pointer of Object.keys(secretRefs)) {
      if (!allowedPointers.has(pointer)) {
        throw new PublicRuntimeError(
          "UNKNOWN_SECRET_POINTER",
          "Secret reference targets an unknown field"
        );
      }
    }
    for (const entry of operation.policy.data.inputs) {
      if (getPointer(request, entry.pointer) !== undefined) {
        throw new PublicRuntimeError(
          "DIRECT_SECRET_DENIED",
          "Protected input must be supplied through a secret reference"
        );
      }
    }
    const projected = projectInput(request, operation.metadata.inputSchema);
    const resolver = this.#options.secretResolver ?? new EnvironmentSecretResolver();
    for (const entry of operation.policy.data.inputs) {
      const reference = secretRefs[entry.pointer];
      if (reference === undefined) {
        if (entry.required) {
          throw new PublicRuntimeError(
            "SECRET_REF_REQUIRED",
            "A required secret reference is missing"
          );
        }
        continue;
      }
      const value = await resolver.resolve(reference);
      if (value === undefined) {
        throw new PublicRuntimeError("SECRET_NOT_FOUND", "A referenced secret is unavailable");
      }
      setPointer(projected, entry.pointer, value);
    }
    serializedSize(projected, this.#options.config.maxInputBytes, "Resolved operation input");
    const validate = this.#inputValidator(operation);
    if (!validate(projected)) {
      // AJV detail 可能携带字段名或 provider payload 路径，公共错误不返回原始校验详情。
      throw new PublicRuntimeError(
        "INVALID_INPUT",
        "Input does not match the public operation schema"
      );
    }
    validateNetworkBoundary(operation.policy.operationId, projected);
    return projected;
  }

  #inputValidator(operation: PublicOperation): ValidateFunction<Record<string, unknown>> {
    const existing = this.#inputValidators.get(operation.policy.operationId);
    if (existing !== undefined) return existing;
    const validate = this.#validator.compile<Record<string, unknown>>(
      operation.metadata.inputSchema
    );
    this.#inputValidators.set(operation.policy.operationId, validate);
    return validate;
  }
}

function isOperationMethod(value: unknown): value is OperationMethod {
  return typeof value === "function";
}
