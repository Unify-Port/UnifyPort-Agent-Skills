# UnifyPort Agent Skills runtime

[English](README.md) | [简体中文](README.zh-CN.md) | [官方网站](https://www.unifyport.ai/) | [API 文档](https://www.unifyport.ai/docs/)

`@unifyport/agent-skills` 提供本仓库的安全 CLI、stdio MCP server、带鉴权的 Streamable HTTP gateway 和 policy-gated OpenAPI facade，所有 Device API 行为都委托给 `@unifyport/agent-core`。

## 从源码构建

```bash
pnpm install --frozen-lockfile
pnpm generate:check
pnpm build
pnpm package:check
```

只有 release 包含验证过的 registry artifact 后，该 package 才视为已发布。
公开交付前在 workspace root 执行 `pnpm check` 作为最终 gate。

## 鉴权

CLI 和 stdio MCP 通过带外方式配置 API Key：

```bash
export UNIFYPORT_API_KEY='<your-api-key>'
```

禁止把该值放入 prompt、CLI 参数、MCP payload 或提交到 Git 的配置。

## CLI

先把非 secret 请求写入文件并 preview，再执行：

```bash
unifyport-agent preview getWorkspace --input-file request.json
unifyport-agent call getWorkspace --input-file request.json
```

写操作同时要求 `UNIFYPORT_ALLOW_WRITES=true` 和 `--confirm`。destructive 操作还要求
`UNIFYPORT_ALLOW_DESTRUCTIVE=true` 与 `--accept-risk`。

受保护输入使用环境引用：

```bash
export UNIFYPORT_SECRET_AUTH_CODE='<one-time-code>'
unifyport-agent call submitAccountAuthCode \
  --input-file request.json \
  --secret-ref /body/code=env:UNIFYPORT_SECRET_AUTH_CODE \
  --confirm
```

一次性输出必须预留一个全新文件：

```bash
unifyport-agent call createApiKey \
  --input-file request.json \
  --confirm \
  --secure-output new-secret.json
```

安全输出文件使用 `0600` mode 创建，且不会覆盖已有文件。

每次 CLI call 都使用 `retry: false` 执行一次 SDK request。Runtime 不会自动分页或重试。调用方必须显式推进公开 cursor、设置 page/item 上限，并且只能在严格的调用方自有边界内重试 policy 允许的 read operation。

## MCP

通过以下命令启动 stdio server：

```bash
unifyport-mcp
```

公开 SDK 已发布的策略是 MCP 硬边界。server 默认只暴露 3 个已批准的 read tools；设置
`UNIFYPORT_ALLOW_WRITES=true` 后增加 1 个已批准的 write tool。其余 operation 仍由 16 个 Skills
和受控 CLI 覆盖，但不会成为原始的模型工具。

## Streamable HTTP gateway

本地 loopback 开发：

```bash
unifyport-agent serve
```

Loopback endpoints 为：

- `POST http://127.0.0.1:8787/mcp`：Streamable HTTP MCP。
- `GET http://127.0.0.1:8787/openapi.json`：当前 tool registry 的 OpenAPI 3.1 投影。
- `POST http://127.0.0.1:8787/tools/<tool-name>`：调用一个投影后的 OpenAPI tool。

MCP 与 tool calls 必须使用 Device API Key 作为 Bearer credential。Session 是无状态的，绝不作为鉴权依据。Schema 和 health endpoints 不执行 Device API operation。

OpenAPI facade 与 MCP 使用同一个 policy-gated registry：默认只包含 3 个 read tools；设置 `UNIFYPORT_ALLOW_WRITES=true` 后增加 `updateApiKeyStatus`。它绝不会把其余 60 个受控 CLI/Skill operations 投影为原始 API routes。Coze 可以消费此 custom OpenAPI document；Dify 应直接连接 Streamable HTTP MCP endpoint。

绑定非 loopback 地址时，必须同时配置 public mode、精确 host allowlist 和 TLS certificate/key，否则进程拒绝启动。可选的精确 origin allowlist 只拒绝携带未批准 `Origin` header 的请求。Gateway 不返回 CORS response headers，因此该设置不会启用浏览器 CORS。Gateway 会限制请求大小、header、timeout 和并发数，并且不记录 header 或 body。

Go 与 Python 后端可以使用任何支持 Streamable HTTP 的 MCP client，参见[后端示例](../../examples/README.zh-CN.md)。
