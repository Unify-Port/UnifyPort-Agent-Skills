import { PublicRuntimeError } from "./errors.js";
import { isRecord } from "./json.js";

const MAX_SCHEMA_DEPTH = 40;
const SENSITIVE_FIELD =
  /(?:api[_-]?key|authorization|cookie|password|secret|token|(?:^|_)code$|(?:^|_)state$|proxy|auth_payload|provider_data|provider_profile|reply_token|session)/iu;

function localDefinition(
  root: Readonly<Record<string, unknown>>,
  reference: string
): Readonly<Record<string, unknown>> | undefined {
  const prefix = "#/$defs/";
  if (!reference.startsWith(prefix)) return undefined;
  const definitions = root["$defs"];
  if (!isRecord(definitions)) return undefined;
  const definition = definitions[reference.slice(prefix.length)];
  return isRecord(definition) ? definition : undefined;
}

function declaredProperties(
  schema: Readonly<Record<string, unknown>>,
  root: Readonly<Record<string, unknown>>,
  depth: number
): ReadonlyMap<string, readonly Readonly<Record<string, unknown>>[]> {
  if (depth > MAX_SCHEMA_DEPTH) {
    throw new PublicRuntimeError("SCHEMA_DEPTH", "Public schema exceeds the supported depth");
  }
  const collected = new Map<string, Readonly<Record<string, unknown>>[]>();
  const add = (name: string, child: Readonly<Record<string, unknown>>): void => {
    collected.set(name, [...(collected.get(name) ?? []), child]);
  };
  const reference = schema["$ref"];
  if (typeof reference === "string") {
    const target = localDefinition(root, reference);
    if (target !== undefined) {
      for (const [name, children] of declaredProperties(target, root, depth + 1)) {
        for (const child of children) add(name, child);
      }
    }
  }
  const properties = schema["properties"];
  if (isRecord(properties)) {
    for (const [name, child] of Object.entries(properties)) {
      if (isRecord(child)) add(name, child);
    }
  }
  for (const keyword of ["allOf", "anyOf", "oneOf"] as const) {
    const branches = schema[keyword];
    if (!Array.isArray(branches)) continue;
    for (const branch of branches) {
      if (!isRecord(branch)) continue;
      for (const [name, children] of declaredProperties(branch, root, depth + 1)) {
        for (const child of children) add(name, child);
      }
    }
  }
  return collected;
}

function projectValue(
  value: unknown,
  schema: Readonly<Record<string, unknown>>,
  root: Readonly<Record<string, unknown>>,
  redactSensitive: boolean,
  depth = 0
): unknown {
  if (depth > MAX_SCHEMA_DEPTH) {
    throw new PublicRuntimeError("VALUE_DEPTH", "Public value exceeds the supported depth");
  }
  const reference = schema["$ref"];
  if (typeof reference === "string") {
    const target = localDefinition(root, reference);
    if (target !== undefined) return projectValue(value, target, root, redactSensitive, depth + 1);
  }
  if (Array.isArray(value)) {
    const items = schema["items"];
    if (!isRecord(items)) return [];
    return value.map((item) => projectValue(item, items, root, redactSensitive, depth + 1));
  }
  if (!isRecord(value)) return value;

  const properties = declaredProperties(schema, root, depth + 1);
  const projected: Record<string, unknown> = {};
  for (const [name, child] of Object.entries(value)) {
    if (redactSensitive && SENSITIVE_FIELD.test(name)) continue;
    const candidates = properties.get(name);
    if (candidates === undefined || candidates.length === 0) continue;
    const childSchema = candidates.length === 1 ? candidates[0] : { anyOf: candidates };
    if (childSchema === undefined) continue;
    projected[name] = projectValue(child, childSchema, root, redactSensitive, depth + 1);
  }
  return projected;
}

export function projectInput(
  input: Readonly<Record<string, unknown>>,
  schema: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const projected = projectValue(input, schema, schema, false);
  if (!isRecord(projected) || JSON.stringify(projected) !== JSON.stringify(input)) {
    // OpenAPI 默认允许 extra property；Agent 工具边界始终只接受契约声明字段。
    throw new PublicRuntimeError("UNDECLARED_INPUT", "Input contains undeclared properties");
  }
  return projected;
}

export function projectOutput(
  output: Readonly<Record<string, unknown>>,
  schema: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const projected = projectValue(output, schema, schema, true);
  if (!isRecord(projected)) {
    throw new PublicRuntimeError("INVALID_OUTPUT", "Projected output must be an object");
  }
  return projected;
}

export function closeInputSchema(
  schema: Readonly<Record<string, unknown>>,
  depth = 0
): Readonly<Record<string, unknown>> {
  if (depth > MAX_SCHEMA_DEPTH) {
    throw new PublicRuntimeError("SCHEMA_DEPTH", "Input schema exceeds the supported depth");
  }
  for (const keyword of [
    "not",
    "if",
    "then",
    "else",
    "patternProperties",
    "dependentSchemas"
  ] as const) {
    if (schema[keyword] !== undefined) {
      // 动态 schema 关键字会使模型输入边界产生歧义，遇到时必须先补显式支持。
      throw new PublicRuntimeError(
        "UNSUPPORTED_SCHEMA",
        `Input schema keyword requires explicit support: ${keyword}`
      );
    }
  }
  const output: Record<string, unknown> = { ...schema };
  for (const keyword of ["properties", "$defs", "definitions"] as const) {
    const children = schema[keyword];
    if (children === undefined) continue;
    if (!isRecord(children)) {
      throw new PublicRuntimeError("INVALID_SCHEMA", `Input schema ${keyword} must be an object`);
    }
    output[keyword] = Object.fromEntries(
      Object.entries(children).map(([name, child]) => {
        if (!isRecord(child)) {
          throw new PublicRuntimeError(
            "INVALID_SCHEMA",
            `Input schema ${keyword}.${name} must be an object`
          );
        }
        return [name, closeInputSchema(child, depth + 1)];
      })
    );
  }
  for (const keyword of ["items", "contains"] as const) {
    const child = schema[keyword];
    if (child === undefined) continue;
    if (!isRecord(child)) {
      throw new PublicRuntimeError("INVALID_SCHEMA", `Input schema ${keyword} must be an object`);
    }
    output[keyword] = closeInputSchema(child, depth + 1);
  }
  for (const keyword of ["allOf", "anyOf", "oneOf", "prefixItems"] as const) {
    const children = schema[keyword];
    if (children === undefined) continue;
    if (!Array.isArray(children)) {
      throw new PublicRuntimeError("INVALID_SCHEMA", `Input schema ${keyword} must be an array`);
    }
    output[keyword] = children.map((child) => {
      if (!isRecord(child)) {
        throw new PublicRuntimeError(
          "INVALID_SCHEMA",
          `Input schema ${keyword} item must be an object`
        );
      }
      return closeInputSchema(child, depth + 1);
    });
  }
  if (
    schema["type"] === "object" ||
    schema["properties"] !== undefined ||
    schema["additionalProperties"] !== undefined
  ) {
    output["additionalProperties"] = false;
  }
  return output;
}
