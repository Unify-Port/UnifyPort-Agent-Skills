import { createHash } from "node:crypto";

import { PublicRuntimeError } from "./errors.js";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => left.localeCompare(right))
      .map((key) => [key, canonicalValue(value[key])])
  );
}

export function serializedSize(value: unknown, limit: number, label: string): void {
  let serialized: unknown;
  try {
    serialized = JSON.stringify(value);
  } catch {
    throw new PublicRuntimeError("INVALID_JSON", `${label} must be JSON serializable`);
  }
  if (typeof serialized !== "string") {
    throw new PublicRuntimeError("INVALID_JSON", `${label} must be JSON serializable`);
  }
  if (Buffer.byteLength(serialized, "utf8") > limit) {
    throw new PublicRuntimeError("PAYLOAD_TOO_LARGE", `${label} exceeds the configured size limit`);
  }
}

export function requestDigest(
  operationId: string,
  request: Readonly<Record<string, unknown>>,
  secretRefs: Readonly<Record<string, string>> = {}
): string {
  const canonical = JSON.stringify(canonicalValue({ operationId, request, secretRefs }));
  return createHash("sha256").update(canonical).digest("hex");
}

function tokens(pointer: string): readonly string[] {
  if (!pointer.startsWith("/")) {
    throw new PublicRuntimeError("INVALID_POLICY", "Data policy pointer must be absolute");
  }
  return pointer
    .slice(1)
    .split("/")
    .map((token) => token.replaceAll("~1", "/").replaceAll("~0", "~"));
}

export function getPointer(root: unknown, pointer: string): unknown {
  let current: unknown = root;
  for (const token of tokens(pointer)) {
    if (!isRecord(current) || !(token in current)) return undefined;
    current = current[token];
  }
  return current;
}

export function setPointer(root: Record<string, unknown>, pointer: string, value: unknown): void {
  const parts = tokens(pointer);
  if (parts.length === 0)
    throw new PublicRuntimeError("INVALID_POLICY", "Root replacement is denied");
  let current = root;
  for (const token of parts.slice(0, -1)) {
    const existing = current[token];
    if (existing === undefined) {
      const next: Record<string, unknown> = {};
      current[token] = next;
      current = next;
    } else if (isRecord(existing)) {
      current = existing;
    } else {
      throw new PublicRuntimeError(
        "INVALID_INPUT",
        "Secret pointer conflicts with request structure"
      );
    }
  }
  const last = parts.at(-1);
  if (last === undefined) throw new PublicRuntimeError("INVALID_POLICY", "Invalid data pointer");
  current[last] = value;
}

export function deletePointer(root: Record<string, unknown>, pointer: string): unknown {
  const parts = tokens(pointer);
  let current: Record<string, unknown> = root;
  for (const token of parts.slice(0, -1)) {
    const next = current[token];
    if (!isRecord(next)) return undefined;
    current = next;
  }
  const last = parts.at(-1);
  if (last === undefined || !(last in current)) return undefined;
  const value = current[last];
  // secret 指针无法删除时必须失败，不能继续返回可能含明文的结果对象。
  if (!Reflect.deleteProperty(current, last)) {
    throw new PublicRuntimeError(
      "SECRET_REDACTION_FAILED",
      "Protected output could not be removed"
    );
  }
  return value;
}
