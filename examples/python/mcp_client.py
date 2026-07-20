"""Minimal Streamable HTTP MCP client using only the Python standard library."""

# 延迟解析类型注解，避免示例在仍受支持的旧版 Python 导入阶段失败。
from __future__ import annotations

import json
import os
import urllib.request
from typing import Any


MCP_URL = os.environ.get("UNIFYPORT_MCP_URL", "http://127.0.0.1:8787/mcp")
MCP_PROTOCOL_VERSION = "2025-11-25"


def request(payload: dict[str, Any]) -> dict[str, Any] | None:
    api_key = os.environ["UNIFYPORT_API_KEY"]
    body = json.dumps(payload).encode("utf-8")
    http_request = urllib.request.Request(
        MCP_URL,
        data=body,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json, text/event-stream",
            "MCP-Protocol-Version": MCP_PROTOCOL_VERSION,
        },
    )
    # 不记录 request headers 或 body，避免 API Key 和业务参数进入日志。
    with urllib.request.urlopen(http_request, timeout=35) as response:
        content = response.read().decode("utf-8")
        if not content:
            return None
        if response.headers.get_content_type() == "text/event-stream":
            data_lines = [line[6:] for line in content.splitlines() if line.startswith("data: ")]
            return json.loads(data_lines[-1]) if data_lines else None
        return json.loads(content)


def main() -> None:
    request(
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": MCP_PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "python-backend", "version": "1.0.0"},
            },
        }
    )
    request({"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}})
    result = request({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
