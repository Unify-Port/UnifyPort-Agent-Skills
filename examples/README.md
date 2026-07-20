# Backend integration examples

[English](README.md) | [简体中文](README.zh-CN.md)

Agent Skills are instruction and policy packages, not Go or Python libraries. A backend service can
still use the same capability surface in two supported ways:

1. Use the public Device API directly with its API key and language-native HTTP client.
2. Connect an MCP client to this repository's authenticated Streamable HTTP gateway.

The second option is useful when the backend is itself an agent host or orchestrator. Configure the
gateway URL separately and provide `UNIFYPORT_API_KEY` only through the process secret environment.
Never copy the value into application logs or JSON-RPC parameters.

The examples intentionally list model-approved tools only; they do not bypass the public SDK MCP
allowlist. Use the controlled local CLI for non-MCP or secret-channel workflows.

- [Python standard-library example](python/mcp_client.py)
- [Go standard-library example](go/main.go)
