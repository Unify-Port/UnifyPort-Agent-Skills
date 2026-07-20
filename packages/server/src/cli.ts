#!/usr/bin/env node
import { constants } from "node:fs";
import { open } from "node:fs/promises";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  AgentRuntime,
  FileSecureSink,
  PublicRuntimeError,
  configFromEnvironment,
  operationPolicies,
  type OperationApproval,
  type OperationPolicy
} from "@unifyport/agent-core";

import { startGateway } from "./gateway.js";
import { installCanonicalSkills, type InstallScope } from "./installer.js";
import { runtimeFromEnvironment } from "./runtime.js";
import { createMcpServer } from "./server.js";

const MAX_INPUT_FILE_BYTES = 256 * 1024;
const SAFE_INSTALL_ERROR_CODE = /^[A-Z][A-Z0-9_]+$/u;
const publicPolicies: Readonly<Record<string, OperationPolicy>> = operationPolicies;

interface ParsedCall {
  readonly operationId: string;
  readonly inputFile: string;
  readonly secretRefs: Readonly<Record<string, string>>;
  readonly confirm: boolean;
  readonly acceptRisk: boolean;
  readonly secureOutput?: string;
}

interface ParsedInstall {
  readonly host: string;
  readonly scope: InstallScope;
  readonly rootDirectory?: string;
  readonly overwrite: boolean;
}

function usage(): string {
  return `UnifyPort Agent Skills CLI

Usage:
  unifyport-agent list
  unifyport-agent install --host <host> [--scope project|user] [--target <root-directory>] [--force]
  unifyport-agent preview <operationId> --input-file <path> [--secret-ref <pointer>=<env-ref>]
  unifyport-agent call <operationId> --input-file <path> [--secret-ref <pointer>=<env-ref>] [--confirm] [--accept-risk] [--secure-output <new-file>]
  unifyport-agent mcp
  unifyport-agent serve

Secrets must use references such as env:UNIFYPORT_SECRET_AUTH_CODE. Never pass a secret value on the command line.
`;
}

function parseInstall(arguments_: readonly string[]): ParsedInstall {
  let host: string | undefined;
  let scope: InstallScope = "project";
  let rootDirectory: string | undefined;
  let overwrite = false;
  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--host") {
      host = requiredValue(arguments_, index, argument);
      index += 1;
    } else if (argument === "--scope") {
      const value = requiredValue(arguments_, index, argument);
      if (value !== "project" && value !== "user") throw new Error("unsupported install scope");
      scope = value;
      index += 1;
    } else if (argument === "--target") {
      rootDirectory = requiredValue(arguments_, index, argument);
      index += 1;
    } else if (argument === "--force") {
      overwrite = true;
    } else {
      throw new Error("unknown install argument");
    }
  }
  if (host === undefined) throw new Error("--host is required");
  return {
    host,
    scope,
    overwrite,
    ...(rootDirectory === undefined ? {} : { rootDirectory })
  };
}

function requiredValue(arguments_: readonly string[], index: number, flag: string): string {
  const value = arguments_[index + 1];
  if (value === undefined || value.startsWith("--")) throw new Error(`${flag} requires a value`);
  return value;
}

function parseCall(arguments_: readonly string[]): ParsedCall {
  const operationId = arguments_[0];
  if (operationId === undefined || operationId.startsWith("--")) {
    throw new Error("operationId is required");
  }
  let inputFile: string | undefined;
  let secureOutput: string | undefined;
  let confirm = false;
  let acceptRisk = false;
  const secretRefs: Record<string, string> = {};
  for (let index = 1; index < arguments_.length; index += 1) {
    const argument = arguments_[index];
    if (argument === "--input-file") {
      inputFile = requiredValue(arguments_, index, argument);
      index += 1;
    } else if (argument === "--secure-output") {
      secureOutput = requiredValue(arguments_, index, argument);
      index += 1;
    } else if (argument === "--secret-ref") {
      const mapping = requiredValue(arguments_, index, argument);
      index += 1;
      const separator = mapping.indexOf("=");
      if (separator <= 0 || separator === mapping.length - 1) {
        throw new Error("--secret-ref must be <pointer>=<env-ref>");
      }
      secretRefs[mapping.slice(0, separator)] = mapping.slice(separator + 1);
    } else if (argument === "--confirm") {
      confirm = true;
    } else if (argument === "--accept-risk") {
      acceptRisk = true;
    } else {
      throw new Error("unknown argument");
    }
  }
  if (inputFile === undefined) throw new Error("--input-file is required");
  return {
    operationId,
    inputFile,
    secretRefs,
    confirm,
    acceptRisk,
    ...(secureOutput === undefined ? {} : { secureOutput })
  };
}

async function readInputFile(path: string): Promise<Record<string, unknown>> {
  try {
    // 同一 no-follow 句柄完成校验和读取，避免 agent 选择的路径在两次调用之间被换成 symlink。
    const handle = await open(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK
    );
    try {
      const file = await handle.stat();
      if (!file.isFile() || file.size > MAX_INPUT_FILE_BYTES) {
        throw new PublicRuntimeError("INVALID_INPUT_FILE", "Input file is invalid or too large");
      }
      const parsed = JSON.parse(await handle.readFile("utf8")) as unknown;
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new PublicRuntimeError("INVALID_INPUT_FILE", "Input file must contain a JSON object");
      }
      return Object.fromEntries(Object.entries(parsed));
    } finally {
      await handle.close();
    }
  } catch (error: unknown) {
    if (error instanceof PublicRuntimeError) throw error;
    // 文件系统和 JSON parser 的原始错误可能包含路径或输入片段，统一收敛成公开错误。
    throw new PublicRuntimeError("INVALID_INPUT_FILE", "Input file is invalid or unreadable");
  }
}

async function runOperation(
  command: "preview" | "call",
  arguments_: readonly string[]
): Promise<void> {
  const parsed = parseCall(arguments_);
  const request = await readInputFile(parsed.inputFile);
  const environment = process.env;
  const baseRuntime = runtimeFromEnvironment(environment);
  const preview = baseRuntime.preview(parsed.operationId, {
    request,
    ...(Object.keys(parsed.secretRefs).length === 0 ? {} : { secretRefs: parsed.secretRefs })
  });
  if (command === "preview") {
    process.stdout.write(`${JSON.stringify(preview, null, 2)}\n`);
    return;
  }
  const policy = publicPolicies[parsed.operationId];
  if (policy === undefined)
    throw new PublicRuntimeError("UNKNOWN_OPERATION", "Unknown public operation");
  let approval: OperationApproval | undefined;
  if (policy.confirmation !== "none") {
    if (!parsed.confirm) {
      throw new PublicRuntimeError(
        "CONFIRMATION_REQUIRED",
        "Use --confirm after reviewing preview"
      );
    }
    approval = {
      operationId: parsed.operationId,
      acknowledged: true,
      ...(policy.confirmation === "confirm" || policy.confirmation === "double_confirm"
        ? { requestDigest: preview.requestDigest }
        : {}),
      ...(parsed.acceptRisk ? { riskAccepted: true } : {})
    };
  }
  const selectedRuntime =
    parsed.secureOutput === undefined
      ? baseRuntime
      : new AgentRuntime({
          config: configFromEnvironment(environment),
          secureSink: new FileSecureSink(parsed.secureOutput)
        });
  const result = await selectedRuntime.invoke(parsed.operationId, {
    request,
    ...(Object.keys(parsed.secretRefs).length === 0 ? {} : { secretRefs: parsed.secretRefs }),
    ...(approval === undefined ? {} : { approval })
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

async function main(arguments_: readonly string[] = process.argv.slice(2)): Promise<void> {
  const command = arguments_[0];
  if (command === undefined || command === "help" || command === "--help" || command === "-h") {
    process.stdout.write(usage());
    return;
  }
  if (command === "list") {
    process.stdout.write(
      `${JSON.stringify(
        Object.values(operationPolicies).map((policy) => ({
          operationId: policy.operationId,
          workflowId: policy.workflowId,
          access: policy.access,
          confirmation: policy.confirmation,
          channel: policy.channel
        })),
        null,
        2
      )}\n`
    );
    return;
  }
  if (command === "install") {
    const parsed = parseInstall(arguments_.slice(1));
    // 安装结果只包含目录和计数，不回显任何 Skill 内容或环境凭证。
    const result = await installCanonicalSkills(parsed);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (command === "preview" || command === "call") {
    await runOperation(command, arguments_.slice(1));
    return;
  }
  if (command === "mcp") {
    const { server } = createMcpServer(runtimeFromEnvironment());
    await server.connect(new StdioServerTransport());
    return;
  }
  if (command === "serve") {
    await startGateway();
    return;
  }
  throw new Error("unknown command");
}

void main().catch((error: unknown) => {
  const code =
    error instanceof PublicRuntimeError
      ? error.code
      : error instanceof Error && SAFE_INSTALL_ERROR_CODE.test(error.message)
        ? error.message
        : "CLI_ERROR";
  // CLI 错误可能由本地路径或 JSON 触发，stderr 只返回安全 code。
  console.error(`[unifyport-agent] failed code=${code}`);
  process.exitCode = 1;
});
