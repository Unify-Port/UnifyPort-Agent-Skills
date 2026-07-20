import type { McpExposure, OperationMetadata, SecretProvider } from "@unifyport/sdk-node";

export type AccessMode = "read" | "write" | "destructive";
export type ConfirmationMode = "none" | "intent" | "confirm" | "double_confirm" | "interactive";
export type ChannelMode =
  "model_safe" | "projected" | "secure_input" | "secure_output" | "secure_input_output";

export interface ClassifiedPointer {
  readonly pointer: string;
  readonly classification: string;
  readonly required: boolean;
}

export interface OperationPolicy {
  readonly operationId: string;
  readonly workflowId: string;
  readonly toolName: string;
  readonly method: string;
  readonly path: string;
  readonly access: AccessMode;
  readonly confirmation: ConfirmationMode;
  readonly channel: ChannelMode;
  readonly retryable: boolean;
  readonly secretInput: boolean;
  readonly secretOutput: boolean;
  readonly mcpExposure: McpExposure;
  readonly data: {
    readonly inputs: readonly ClassifiedPointer[];
    readonly outputs: readonly ClassifiedPointer[];
  };
}

export interface RuntimePermissions {
  readonly enableWrites: boolean;
  readonly enableDestructive: boolean;
}

export interface RuntimeConfig {
  readonly baseUrl: string;
  readonly apiKey: SecretProvider;
  readonly permissions: RuntimePermissions;
  readonly timeoutMs: number;
  readonly maxInputBytes: number;
  readonly maxOutputBytes: number;
}

export interface OperationApproval {
  readonly operationId: string;
  readonly acknowledged: true;
  readonly requestDigest?: string;
  readonly riskAccepted?: true;
}

export interface OperationCall {
  readonly request: Readonly<Record<string, unknown>>;
  readonly secretRefs?: Readonly<Record<string, string>>;
  readonly approval?: OperationApproval;
}

export interface OperationPreview {
  readonly operationId: string;
  readonly workflowId: string;
  readonly method: string;
  readonly path: string;
  readonly access: AccessMode;
  readonly confirmation: ConfirmationMode;
  readonly requestDigest: string;
}

export interface SecureReceipt {
  readonly sink: string;
  readonly fields: number;
}

export interface SafeOperationResult {
  readonly data: unknown;
  readonly meta: {
    readonly status: number;
    readonly requestId?: string;
  };
  readonly secureReceipts?: readonly SecureReceipt[];
}

export interface SecretResolver {
  readonly resolve: (reference: string) => Promise<string | undefined>;
}

export interface SecureOutputReservation {
  readonly commit: (values: Readonly<Record<string, unknown>>) => Promise<SecureReceipt>;
  readonly abort: () => Promise<void>;
}

export interface SecureSink {
  readonly reserve: (
    operationId: string,
    pointers: readonly string[]
  ) => Promise<SecureOutputReservation>;
}

export interface AgentRuntimeOptions {
  readonly config: RuntimeConfig;
  readonly client?: object;
  readonly secretResolver?: SecretResolver;
  readonly secureSink?: SecureSink;
}

export interface PublicOperation {
  readonly policy: OperationPolicy;
  readonly metadata: OperationMetadata;
}
