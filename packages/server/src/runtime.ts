import {
  AgentRuntime,
  FileSecureSink,
  configFromApiKeyProvider,
  configFromEnvironment
} from "@unifyport/agent-core";

export function runtimeFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env
): AgentRuntime {
  const outputPath = environment["UNIFYPORT_SECURE_OUTPUT_FILE"];
  return new AgentRuntime({
    config: configFromEnvironment(environment),
    ...(outputPath === undefined || outputPath === ""
      ? {}
      : { secureSink: new FileSecureSink(outputPath) })
  });
}

export function runtimeFromApiKey(
  apiKey: string,
  environment: Readonly<Record<string, string | undefined>> = process.env
): AgentRuntime {
  // Remote gateway 只在闭包中保存当前请求凭证，绝不写回 process.env 或共享 session。
  return new AgentRuntime({ config: configFromApiKeyProvider(() => apiKey, environment) });
}
