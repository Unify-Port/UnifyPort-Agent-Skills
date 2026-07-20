# UnifyPort Agent Core

[English](README.md) | [简体中文](README.zh-CN.md)

`@unifyport/agent-core` 是本仓库共享的策略 runtime，消费固定版本的公开 Device API SDK 和生成的
operation policy catalog。

该 package 强制执行：

- 仅按固定 operation 分发，不支持任意 method、path、header 或 base URL；
- read、write 和 destructive 权限门禁；
- 与请求绑定的确认 digest；
- 封闭输入投影与声明字段输出投影；
- 仅通过环境提供 API 鉴权；
- 受保护输入使用 secret reference；
- 一次性 secret 输出前预留安全 sink；
- 只包含稳定 code、status 和 request ID 的安全错误。

该 package 的源码已在仓库实现，但只有 release 同时包含 registry metadata 和验证过的 package artifact
后，才视为已经发布。

CLI、stdio MCP 或 Streamable HTTP 的使用方式见上层 [server package](../server/README.zh-CN.md)。
