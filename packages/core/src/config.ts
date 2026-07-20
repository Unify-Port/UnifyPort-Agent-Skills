import type { RuntimeConfig } from "./types.js";
import type { SecretProvider } from "@unifyport/sdk-node";

export const DEVICE_API_BASE_URL = "https://api.unifyport.ai";
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_INPUT_BYTES = 256 * 1024;
const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;

export class ConfigurationError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = "ConfigurationError";
  }
}

function enabled(value: string | undefined): boolean {
  // 只有精确的 true 才扩大权限，拼写错误和未知值都保持 fail-closed。
  return value === "true";
}

export function configFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env
): RuntimeConfig {
  const readApiKey = (): string | undefined => {
    const value = environment["UNIFYPORT_API_KEY"]?.trim();
    return value === "" ? undefined : value;
  };
  if (readApiKey() === undefined) {
    throw new ConfigurationError("UNIFYPORT_API_KEY is required");
  }
  return configFromApiKeyProvider(readApiKey, environment);
}

export function configFromApiKeyProvider(
  apiKey: SecretProvider,
  environment: Readonly<Record<string, string | undefined>> = process.env
): RuntimeConfig {
  const enableWrites = enabled(environment["UNIFYPORT_ALLOW_WRITES"]);
  const enableDestructive = enableWrites && enabled(environment["UNIFYPORT_ALLOW_DESTRUCTIVE"]);
  return {
    baseUrl: DEVICE_API_BASE_URL,
    // 闭包按调用读取 secret，避免配置对象和诊断输出长期持有明文 Key。
    apiKey,
    permissions: { enableWrites, enableDestructive },
    timeoutMs: DEFAULT_TIMEOUT_MS,
    maxInputBytes: DEFAULT_MAX_INPUT_BYTES,
    maxOutputBytes: DEFAULT_MAX_OUTPUT_BYTES
  };
}
