import { readFile } from "node:fs/promises";
import {
  createServer,
  type IncomingMessage,
  type RequestListener,
  type ServerResponse
} from "node:http";
import { createServer as createSecureServer } from "node:https";

import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { PublicRuntimeError, type AgentRuntime } from "@unifyport/agent-core";

import {
  createOpenApiAdapterDocument,
  OPENAPI_DOCUMENT_PATH,
  TOOL_PATH_PREFIX,
  toolNameFromPath
} from "./openapi-adapter.js";
import { createToolRegistry } from "./registry.js";
import { runtimeFromApiKey } from "./runtime.js";
import { createMcpServer } from "./server.js";

const MAX_BODY_BYTES = 256 * 1024;
const MAX_CONCURRENT_REQUESTS = 32;

export interface GatewayConfig {
  readonly host: string;
  readonly port: number;
  readonly allowedHosts: ReadonlySet<string>;
  readonly allowedOrigins: ReadonlySet<string>;
  readonly publicMode: boolean;
  readonly tlsCertificateFile?: string;
  readonly tlsKeyFile?: string;
}

export type GatewayRuntimeFactory = (
  apiKey: string,
  environment: Readonly<Record<string, string | undefined>>
) => AgentRuntime;

function list(value: string | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry !== "")
  );
}

function loopback(host: string): boolean {
  return host === "127.0.0.1" || host === "::1" || host === "localhost";
}

export function gatewayConfigFromEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env
): GatewayConfig {
  const requestedHost = environment["UNIFYPORT_GATEWAY_HOST"]?.trim();
  // 空配置继续限定到 loopback，避免部署模板中的空变量意外扩大监听范围。
  const host = requestedHost === undefined || requestedHost === "" ? "127.0.0.1" : requestedHost;
  const portValue = Number(environment["UNIFYPORT_GATEWAY_PORT"] ?? "8787");
  if (!Number.isInteger(portValue) || portValue < 1 || portValue > 65_535) {
    throw new Error("UNIFYPORT_GATEWAY_PORT must be a valid TCP port");
  }
  const publicMode = !loopback(host);
  const allowedHosts = list(environment["UNIFYPORT_GATEWAY_ALLOWED_HOSTS"]);
  const tlsCertificateFile = environment["UNIFYPORT_GATEWAY_TLS_CERT_FILE"]?.trim();
  const tlsKeyFile = environment["UNIFYPORT_GATEWAY_TLS_KEY_FILE"]?.trim();
  if (publicMode && environment["UNIFYPORT_GATEWAY_PUBLIC"] !== "true") {
    throw new Error("Non-loopback gateway binding requires UNIFYPORT_GATEWAY_PUBLIC=true");
  }
  if (publicMode && allowedHosts.size === 0) {
    throw new Error("Public gateway binding requires an explicit host allowlist");
  }
  if (publicMode && (tlsCertificateFile === undefined || tlsKeyFile === undefined)) {
    throw new Error("Public gateway binding requires a TLS certificate and key");
  }
  return {
    host,
    port: portValue,
    allowedHosts,
    allowedOrigins: list(environment["UNIFYPORT_GATEWAY_ALLOWED_ORIGINS"]),
    publicMode,
    ...(tlsCertificateFile === undefined ? {} : { tlsCertificateFile }),
    ...(tlsKeyFile === undefined ? {} : { tlsKeyFile })
  };
}

function hostname(request: IncomingMessage): string | undefined {
  const host = request.headers.host;
  if (host === undefined) return undefined;
  try {
    return new URL(`http://${host}`).hostname;
  } catch {
    return undefined;
  }
}

function authorizedApiKey(request: IncomingMessage): string | undefined {
  const authorization = request.headers.authorization;
  if (authorization === undefined || Array.isArray(authorization)) return undefined;
  const match = /^Bearer ([^\s]{8,4096})$/u.exec(authorization);
  return match?.[1];
}

function writeJson(response: ServerResponse, status: number, value: unknown): void {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(`${JSON.stringify(value)}\n`);
}

function writeResponse(response: ServerResponse, status: number, code: string): void {
  writeJson(response, status, { error: { code } });
}

function writeHealth(response: ServerResponse): void {
  writeJson(response, 200, { status: "ok" });
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const declared = Number(request.headers["content-length"] ?? "0");
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const rawChunk of request) {
    const chunk: unknown = rawChunk;
    if (!(chunk instanceof Uint8Array) && typeof chunk !== "string") {
      throw new Error("INVALID_BODY_CHUNK");
    }
    const buffer = Buffer.from(chunk);
    total += buffer.byteLength;
    if (total > MAX_BODY_BYTES) throw new Error("BODY_TOO_LARGE");
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new Error("INVALID_JSON");
  }
}

function requestAllowed(request: IncomingMessage, config: GatewayConfig): boolean {
  const requestHost = hostname(request);
  if (requestHost === undefined) return false;
  if (config.publicMode && !config.allowedHosts.has(requestHost)) return false;
  if (!config.publicMode && !loopback(requestHost)) return false;
  if (!config.publicMode && !loopback(request.socket.localAddress ?? "")) return false;
  const origin = request.headers.origin;
  if (origin !== undefined && !config.allowedOrigins.has(origin)) return false;
  if (config.publicMode && !("encrypted" in request.socket && request.socket.encrypted === true)) {
    return false;
  }
  return true;
}

function requestPath(request: IncomingMessage): string | undefined {
  if (request.url === undefined) return undefined;
  try {
    const target = new URL(request.url, "http://gateway.invalid");
    return target.search === "" ? target.pathname : undefined;
  } catch {
    return undefined;
  }
}

function requestOrigin(request: IncomingMessage, config: GatewayConfig): string {
  const host = request.headers.host;
  if (host === undefined) throw new Error("HOST_REQUIRED");
  return new URL(`${config.publicMode ? "https" : "http"}://${host}`).origin;
}

function publicErrorStatus(error: PublicRuntimeError): number {
  if (error.status !== undefined && error.status >= 400 && error.status <= 599) return error.status;
  return error.code.endsWith("_DISABLED") ? 403 : 400;
}

function createGatewayHandler(
  config: GatewayConfig,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  runtimeFactory: GatewayRuntimeFactory = runtimeFromApiKey
): RequestListener {
  let activeRequests = 0;
  const handleRequest = async (
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> => {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    if (!requestAllowed(request, config)) {
      writeResponse(response, 403, "REQUEST_DENIED");
      return;
    }
    const pathname = requestPath(request);
    if (pathname === "/healthz" && request.method === "GET") {
      writeHealth(response);
      return;
    }
    if (pathname === OPENAPI_DOCUMENT_PATH && request.method === "GET") {
      // Schema 使用空操作凭证构建，但只读取 registry metadata，不触发任何 API 请求。
      const registry = createToolRegistry(runtimeFactory("<schema-only>", environment));
      writeJson(
        response,
        200,
        createOpenApiAdapterDocument(registry, requestOrigin(request, config))
      );
      return;
    }
    const mcpRequest = pathname === "/mcp" && request.method === "POST";
    const toolRequest =
      pathname?.startsWith(TOOL_PATH_PREFIX) === true && request.method === "POST";
    if (!mcpRequest && !toolRequest) {
      writeResponse(response, 404, "NOT_FOUND");
      return;
    }
    if (!request.headers["content-type"]?.toLowerCase().startsWith("application/json")) {
      writeResponse(response, 415, "UNSUPPORTED_MEDIA_TYPE");
      return;
    }
    const apiKey = authorizedApiKey(request);
    if (apiKey === undefined) {
      response.setHeader("WWW-Authenticate", "Bearer");
      writeResponse(response, 401, "AUTH_REQUIRED");
      return;
    }
    if (activeRequests >= MAX_CONCURRENT_REQUESTS) {
      writeResponse(response, 429, "TOO_MANY_REQUESTS");
      return;
    }
    activeRequests += 1;
    try {
      const body = await readJsonBody(request);
      const runtime = runtimeFactory(apiKey, environment);
      if (toolRequest) {
        const toolName = toolNameFromPath(pathname);
        const registry = createToolRegistry(runtime);
        if (toolName === undefined || !registry.registrations.has(toolName)) {
          writeResponse(response, 404, "TOOL_NOT_FOUND");
          return;
        }
        if (body === null || typeof body !== "object" || Array.isArray(body)) {
          writeResponse(response, 400, "INVALID_ARGUMENTS");
          return;
        }
        const controller = new AbortController();
        const abort = (): void => {
          controller.abort();
        };
        request.once("aborted", abort);
        try {
          const result = await registry.invoke(
            toolName,
            Object.fromEntries(Object.entries(body)),
            controller.signal
          );
          writeJson(response, 200, result);
        } finally {
          request.off("aborted", abort);
        }
        return;
      }
      const transport = new StreamableHTTPServerTransport();
      const { server: mcpServer } = createMcpServer(runtime);
      await mcpServer.connect(transport);
      try {
        // 每次请求都重新鉴权；session identifier 不能替代 Bearer credential。
        await transport.handleRequest(request, response, body);
      } finally {
        await mcpServer.close();
      }
    } catch (error) {
      if (!response.headersSent) {
        if (error instanceof PublicRuntimeError) {
          writeResponse(response, publicErrorStatus(error), error.code);
        } else {
          const code =
            error instanceof Error && error.message === "BODY_TOO_LARGE"
              ? "BODY_TOO_LARGE"
              : "BAD_REQUEST";
          writeResponse(response, code === "BODY_TOO_LARGE" ? 413 : 400, code);
        }
      }
    } finally {
      activeRequests -= 1;
    }
  };
  return (request, response): void => {
    // Node 的 listener 签名不等待 Promise；内部 handler 已把失败收敛为安全 HTTP code。
    void handleRequest(request, response);
  };
}

function configureServer<T extends ReturnType<typeof createServer>>(server: T): T {
  server.requestTimeout = 35_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 64;
  return server;
}

export function createGateway(
  config: GatewayConfig,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  runtimeFactory: GatewayRuntimeFactory = runtimeFromApiKey
): ReturnType<typeof createServer> {
  if (config.publicMode || !loopback(config.host)) {
    // 明文 server 只允许测试和 loopback；公网启动必须走直接 TLS 的受控入口。
    throw new Error("Public gateway requires the TLS server entry point");
  }
  return configureServer(createServer(createGatewayHandler(config, environment, runtimeFactory)));
}

async function createPublicGateway(
  config: GatewayConfig,
  environment: Readonly<Record<string, string | undefined>>
): Promise<ReturnType<typeof createSecureServer>> {
  if (config.tlsCertificateFile === undefined || config.tlsKeyFile === undefined) {
    throw new Error("Public gateway TLS configuration is incomplete");
  }
  const [cert, key] = await Promise.all([
    readFile(config.tlsCertificateFile),
    readFile(config.tlsKeyFile)
  ]);
  const server = createSecureServer({ cert, key }, createGatewayHandler(config, environment));
  server.requestTimeout = 35_000;
  server.headersTimeout = 10_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 64;
  return server;
}

export async function startGateway(
  environment: Readonly<Record<string, string | undefined>> = process.env
): Promise<void> {
  const config = gatewayConfigFromEnvironment(environment);
  const server = config.publicMode
    ? await createPublicGateway(config, environment)
    : createGateway(config, environment);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(config.port, config.host, resolve);
  });
  // 不输出 URL、header 或 credential；启动日志只保留公开监听模式。
  console.error(`[gateway] listening mode=${config.publicMode ? "public" : "loopback"}`);
}
