import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import YAML from "yaml";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export type AccessMode = "read" | "write" | "destructive";
export type ConfirmationMode = "none" | "intent" | "confirm" | "double_confirm" | "interactive";
export type ChannelMode =
  "model_safe" | "projected" | "secure_input" | "secure_output" | "secure_input_output";

export interface CapabilityOperation {
  readonly id: string;
  readonly access: AccessMode;
  readonly confirmation: ConfirmationMode;
  readonly channel: ChannelMode;
}

export interface CapabilityWorkflow {
  readonly id: string;
  readonly title: string;
  readonly titleZh: string;
  readonly description: string;
  readonly descriptionZh: string;
  readonly operations: readonly CapabilityOperation[];
}

export interface CapabilityCatalog {
  readonly schemaVersion: number;
  readonly expectedOperationCount: number;
  readonly expectedWorkflowCount: number;
  readonly workflows: readonly CapabilityWorkflow[];
}

export interface ClassifiedPointer {
  readonly pointer: string;
  readonly classification: string;
  readonly required: boolean;
}

export interface OperationDataOverride {
  readonly inputs: readonly ClassifiedPointer[];
  readonly outputs: readonly ClassifiedPointer[];
}

export interface DataPolicy {
  readonly schemaVersion: number;
  readonly defaultClassification: string;
  readonly operationOverrides: Readonly<Record<string, OperationDataOverride>>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requiredRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
  return value;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== "string" || value === "") throw new Error(`${label} must be a string`);
  return value;
}

function requiredNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error(`${label} must be an integer`);
  }
  return value;
}

function requiredArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

function enumValue<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  const matched = typeof value === "string" ? allowed.find((entry) => entry === value) : undefined;
  if (matched === undefined) {
    throw new Error(`${label} has an unsupported value`);
  }
  return matched;
}

async function loadYaml(path: string): Promise<unknown> {
  return YAML.parse(await readFile(resolve(ROOT, path), "utf8")) as unknown;
}

export async function loadCapabilityCatalog(): Promise<CapabilityCatalog> {
  const document = requiredRecord(await loadYaml("capabilities/catalog.yaml"), "catalog");
  const workflows = requiredArray(document["workflows"], "catalog.workflows").map(
    (workflowValue, workflowIndex): CapabilityWorkflow => {
      const workflow = requiredRecord(workflowValue, `workflow[${String(workflowIndex)}]`);
      const id = requiredString(workflow["id"], `workflow[${String(workflowIndex)}].id`);
      const operations = requiredArray(workflow["operations"], `${id}.operations`).map(
        (operationValue, operationIndex): CapabilityOperation => {
          const operation = requiredRecord(
            operationValue,
            `${id}.operations[${String(operationIndex)}]`
          );
          return {
            id: requiredString(operation["id"], `${id}.operations.id`),
            access: enumValue(
              operation["access"],
              ["read", "write", "destructive"] as const,
              `${id}.access`
            ),
            confirmation: enumValue(
              operation["confirmation"],
              ["none", "intent", "confirm", "double_confirm", "interactive"] as const,
              `${id}.confirmation`
            ),
            channel: enumValue(
              operation["channel"],
              [
                "model_safe",
                "projected",
                "secure_input",
                "secure_output",
                "secure_input_output"
              ] as const,
              `${id}.channel`
            )
          };
        }
      );
      return {
        id,
        title: requiredString(workflow["title"], `${id}.title`),
        titleZh: requiredString(workflow["title_zh"], `${id}.title_zh`),
        description: requiredString(workflow["description"], `${id}.description`),
        descriptionZh: requiredString(workflow["description_zh"], `${id}.description_zh`),
        operations
      };
    }
  );
  return {
    schemaVersion: requiredNumber(document["schema_version"], "catalog.schema_version"),
    expectedOperationCount: requiredNumber(
      document["expected_operation_count"],
      "catalog.expected_operation_count"
    ),
    expectedWorkflowCount: requiredNumber(
      document["expected_workflow_count"],
      "catalog.expected_workflow_count"
    ),
    workflows
  };
}

function classifiedPointers(value: unknown, label: string): readonly ClassifiedPointer[] {
  if (value === undefined) return [];
  return requiredArray(value, label).map((pointerValue, index) => {
    const pointer = requiredRecord(pointerValue, `${label}[${String(index)}]`);
    return {
      pointer: requiredString(pointer["pointer"], `${label}.pointer`),
      classification: requiredString(pointer["classification"], `${label}.classification`),
      required: pointer["required"] === true
    };
  });
}

export async function loadDataPolicy(): Promise<DataPolicy> {
  const document = requiredRecord(
    await loadYaml("policies/data-classification.yaml"),
    "data policy"
  );
  const rawOverrides = requiredRecord(
    document["operation_overrides"],
    "data policy.operation_overrides"
  );
  const operationOverrides = Object.fromEntries(
    Object.entries(rawOverrides).map(([operationId, overrideValue]) => {
      const override = requiredRecord(overrideValue, `operation override ${operationId}`);
      return [
        operationId,
        {
          inputs: classifiedPointers(override["inputs"], `${operationId}.inputs`),
          outputs: classifiedPointers(override["outputs"], `${operationId}.outputs`)
        }
      ];
    })
  );
  return {
    schemaVersion: requiredNumber(document["schema_version"], "data policy.schema_version"),
    defaultClassification: requiredString(
      document["default_classification"],
      "data policy.default_classification"
    ),
    operationOverrides
  };
}

export function flattenOperations(
  catalog: CapabilityCatalog
): readonly (CapabilityOperation & { readonly workflowId: string })[] {
  return catalog.workflows.flatMap((workflow) =>
    workflow.operations.map((operation) => ({ ...operation, workflowId: workflow.id }))
  );
}
