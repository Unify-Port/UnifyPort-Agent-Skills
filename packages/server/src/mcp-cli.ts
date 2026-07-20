#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { runtimeFromEnvironment } from "./runtime.js";
import { createMcpServer } from "./server.js";

async function main(): Promise<void> {
  const { server } = createMcpServer(runtimeFromEnvironment());
  // connect 会启动 transport；重复 start 会破坏 MCP 生命周期。
  await server.connect(new StdioServerTransport());
}

void main().catch((error: unknown) => {
  const kind = error instanceof Error ? error.name : "UnknownError";
  // 启动错误的 message 可能包含环境细节，stderr 只记录类型。
  console.error(`[mcp] fatal startup error kind=${kind}`);
  process.exitCode = 1;
});
