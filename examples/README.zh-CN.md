# 后端集成示例

[English](README.md) | [简体中文](README.zh-CN.md)

Agent Skills 是指令与策略 package，不是 Go 或 Python library。后端服务仍可通过两种方式使用同一能力面：

1. 使用 API Key 和语言原生 HTTP client 直接调用公开 Device API。
2. 使用 MCP client 连接本仓库带鉴权的 Streamable HTTP gateway。

当后端本身是 agent host 或 orchestrator 时，第二种方式更合适。gateway URL 单独配置，
`UNIFYPORT_API_KEY` 只能通过进程 secret 环境提供。禁止把该值复制到应用日志或 JSON-RPC 参数。

示例只列出模型已批准的 tools，不会绕过公开 SDK MCP allowlist。非 MCP 或需要 secret channel 的工作流
应使用受控的本地 CLI。

- [Python 标准库示例](python/mcp_client.py)
- [Go 标准库示例](go/main.go)
