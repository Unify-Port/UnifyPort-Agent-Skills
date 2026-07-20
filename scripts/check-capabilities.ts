import { deviceOperations, type OperationMetadata } from "@unifyport/sdk-node";

import { flattenOperations, loadCapabilityCatalog, loadDataPolicy } from "./lib/catalog.js";

const catalog = await loadCapabilityCatalog();
const dataPolicy = await loadDataPolicy();
const operations = flattenOperations(catalog);
const failures: string[] = [];
// 宽化为只读字典后，未知 operation 才能作为 drift 被显式报告而不是靠类型断言跳过。
const sdkOperations: Readonly<Record<string, OperationMetadata>> = deviceOperations;

if (catalog.schemaVersion !== 1) failures.push("unsupported capability schema version");
if (dataPolicy.schemaVersion !== 1) failures.push("unsupported data policy schema version");
if (dataPolicy.defaultClassification !== "internal_only") {
  failures.push("data policy must fail closed with internal_only");
}
if (catalog.workflows.length !== catalog.expectedWorkflowCount) {
  failures.push(
    `workflow count expected=${String(catalog.expectedWorkflowCount)} actual=${String(catalog.workflows.length)}`
  );
}
if (operations.length !== catalog.expectedOperationCount) {
  failures.push(
    `operation count expected=${String(catalog.expectedOperationCount)} actual=${String(operations.length)}`
  );
}

const seen = new Set<string>();
for (const operation of operations) {
  if (seen.has(operation.id)) failures.push(`duplicate operation: ${operation.id}`);
  seen.add(operation.id);
  const sdkOperation = sdkOperations[operation.id];
  if (sdkOperation === undefined) {
    failures.push(`operation missing from public SDK: ${operation.id}`);
    continue;
  }

  if (sdkOperation.mutability === "read" && operation.access !== "read") {
    failures.push(`${operation.id}: read operation cannot be widened to ${operation.access}`);
  }
  if (sdkOperation.mutability === "destructive" && operation.access !== "destructive") {
    failures.push(`${operation.id}: destructive SDK operation must remain destructive`);
  }
  if (sdkOperation.mutability === "write" && operation.access === "read") {
    failures.push(`${operation.id}: write SDK operation cannot be classified as read`);
  }
  if (operation.access !== "read" && operation.confirmation === "none") {
    failures.push(`${operation.id}: mutations require an explicit confirmation policy`);
  }
  if (operation.access === "destructive" && operation.confirmation === "intent") {
    failures.push(`${operation.id}: destructive operation requires confirm or double_confirm`);
  }

  const secureInput =
    operation.channel === "secure_input" || operation.channel === "secure_input_output";
  const secureOutput =
    operation.channel === "secure_output" || operation.channel === "secure_input_output";
  const override = dataPolicy.operationOverrides[operation.id];
  if (sdkOperation.secretInput && !secureInput) {
    failures.push(`${operation.id}: SDK secret input requires a secure input channel`);
  }
  if (secureInput && (override?.inputs.length ?? 0) === 0) {
    failures.push(`${operation.id}: secure input channel requires classified pointers`);
  }
  if (secureOutput && (override?.outputs.length ?? 0) === 0) {
    failures.push(`${operation.id}: secure output channel requires classified pointers`);
  }
  if (sdkOperation.secretOutput && !secureOutput && operation.channel !== "projected") {
    failures.push(`${operation.id}: SDK secret output requires secure sink or safe projection`);
  }
}

for (const operationId of Object.keys(deviceOperations)) {
  if (!seen.has(operationId)) failures.push(`public SDK operation is unassigned: ${operationId}`);
}
for (const operationId of Object.keys(dataPolicy.operationOverrides)) {
  if (!seen.has(operationId))
    failures.push(`data policy references unknown operation: ${operationId}`);
}

if (failures.length > 0) {
  for (const failure of failures) process.stderr.write(`[capabilities:check] ${failure}\n`);
  throw new Error(`capability validation found ${String(failures.length)} issue(s)`);
}

process.stderr.write(
  `[capabilities:check] ${String(catalog.workflows.length)} workflows cover ${String(operations.length)} operations exactly once\n`
);
