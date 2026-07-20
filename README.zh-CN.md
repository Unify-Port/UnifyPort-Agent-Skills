# UnifyPort Agent Skills

[English](README.md) | [简体中文](README.zh-CN.md) | [官方网站](https://www.unifyport.ai/) | [API 文档](https://www.unifyport.ai/docs/)

UnifyPort Agent Skills 是面向 AI agent 使用 UnifyPort Device API 的公开、安全集成层。仓库整合公开 SDK operation metadata、共享安全策略、任务型 Skills、受控 CLI、MCP transports，以及 host/platform adapters。

## 当前状态

当前公开 SDK 导出 **64 个 operations**，capability catalog 将每个 operation 唯一归属到 **16 个任务型 Skills**。共享 runtime、受控 CLI、stdio MCP server、带鉴权的 Streamable HTTP gateway 和 adapter source 已在本仓库实现并测试。npm packages **尚未发布**；在官方宣布经过验证的 registry release 之前，请从源码构建和评估。

源码实现不等于厂商侧部署。目录 installers 和 OpenClaw staging metadata 只经过本地测试；TRAE 仍采用手工导入，Dify/Coze 使用平台 integration recipes。本仓库不声称任何 adapter 已在厂商托管环境完成端到端验证。

## 设计目标

- 普通 API 鉴权只要求提供 `UNIFYPORT_API_KEY`。
- 在保持公开 wire behavior 精确一致的同时，向 agent 提供任务导向的工作流。
- 让生成客户端、Skills、CLI、MCP 和 host adapters 共用唯一 operation catalog。
- 默认采用最小权限、由调用方限制分页、日志脱敏，并对高影响操作要求明确确认。
- 防止 secrets、私有基础设施细节和个人数据进入公开产物或模型可见通道。

## 16 个任务型 Skills

| Skill                    | 用途                                            | 默认暴露策略        |
| ------------------------ | ----------------------------------------------- | ------------------- |
| `workspace-overview`     | 验证访问并查看当前 workspace                    | 只读                |
| `workspace-settings`     | 修改 workspace 设置                             | Admin，必须确认     |
| `api-key-lifecycle`      | 列出、创建、启停和轮换 API Key                  | Admin，要求安全输出 |
| `account-lifecycle`      | 发现可用区域并管理连接账号                      | 受保护              |
| `account-authentication` | 完成二维码、验证码、密码或 session 授权流程     | 交互式安全通道      |
| `account-runtime`        | 刷新、启动、停止或重连账号                      | 受保护              |
| `conversation-explorer`  | 列出会话并查看详情或成员                        | 只读                |
| `conversation-state`     | 修改已读、静音或置顶状态                        | 要求明确用户意图    |
| `conversation-labels`    | 列出和管理会话标签                              | 受保护              |
| `contact-directory`      | 搜索联系人并查看联系人状态                      | 只读，包含敏感数据  |
| `contact-controls`       | 封锁、解封联系人或设置备注                      | 受保护              |
| `group-explorer`         | 查看群组、入群申请和邀请信息                    | 只读，包含敏感数据  |
| `group-administration`   | 创建或修改群组及成员关系                        | 高影响确认          |
| `message-sender`         | 发送文本、媒体、文件、名片、回复或 mention 消息 | 外部副作用          |
| `message-actions`        | 置顶、撤回、回应或编辑已有消息                  | 受保护              |
| `webhook-endpoints`      | 管理事件投递 endpoint                           | Admin，要求安全输入 |

上述映射是覆盖不变量：64 个公开 `operationId` 必须全部出现且仅出现一次，不允许遗漏或重复归属。

## Runtime、CLI 与 MCP

已实现的共享 runtime 统一负责鉴权、请求构造、响应 envelope、稳定错误码、request ID、timeout enforcement、脱敏和安全元数据。它始终向 SDK 传入 `retry: false`，也不会自动分页；retryability 和 pagination 只是 policy guidance，调用方必须显式且有界地处理。所有 adapters 都必须委托共享 runtime 执行 API，不能自行重新实现。

- **受控 CLI：** 表示全部 64 个 operations；需要安全输入、一次性 secret 输出或确认的工作流必须使用此入口。写操作要求 `UNIFYPORT_ALLOW_WRITES=true`，destructive 操作还要求独立的 `UNIFYPORT_ALLOW_DESTRUCTIVE=true` 开关。
- **stdio MCP：** 默认只暴露 `getWorkspace`、`listApiKeys` 和 `listProviderRegions`。设置 `UNIFYPORT_ALLOW_WRITES=true` 后增加 `updateApiKeyStatus`；其余 60 个 operations 仍通过 Skills 和受控 CLI 使用，不注册为原始模型工具。
- **Streamable HTTP 与 OpenAPI facade：** `/mcp` 通过无状态 gateway 暴露 MCP allowlist。`GET /openapi.json` 投影同一组已注册 tools，`POST /tools/<tool-name>` 供 OpenAPI consumers 调用单个投影 tool。Tool execution 必须以 Bearer credential 携带 Device API Key；schema 和 health endpoints 不执行 Device API operation。
- **Host/platform adapters：** 安装 canonical Skill assets 或提供明确的 integration recipe，不改变 runtime policy。

各 host 的准确支持等级和安装方式见 [Adapter 支持](docs/adapters.zh-CN.md)。存在源码不等于已经发布 npm package，也不等于已经完成厂商托管环境端到端验证。

## 鉴权

通过进程环境或经批准的 host secret store 提供 API Key：

```bash
export UNIFYPORT_API_KEY='<your-api-key>'
```

不要把 API Key 放入 prompt、命令参数、提交到 Git 的配置、MCP tool payload、测试 fixture 或日志。运行时负责把它映射为公开 API 鉴权 header，并从诊断信息中脱敏。

部分工作流还需要额外受保护的数据，例如一次性验证码、密码、导入 session、webhook signing secret 或新签发的 API Key。这些操作仍属于 64-operation 覆盖范围，但必须通过 CLI 安全输入或 host 提供的安全通道执行，不能作为原始的模型可见 MCP tool 暴露。

## 从源码构建

需要 Node.js 22.12 或更高版本以及 pnpm 10：

```bash
pnpm install --frozen-lockfile
pnpm generate:check
pnpm build
```

在经过验证的 registry artifact 发布前，源码树中的 npm names 和 executable entry points 都属于预发布接口。CLI、stdio MCP 和 Streamable HTTP 用法见 [runtime package 指南](packages/server/README.zh-CN.md)，installer 用法见 [Adapter 支持](docs/adapters.zh-CN.md)。

### 远程 gateway 边界

`unifyport-agent serve` 默认监听 `127.0.0.1:8787`。绑定非 loopback 地址时，缺少以下任一配置都会 fail closed：

- `UNIFYPORT_GATEWAY_PUBLIC=true`。
- 精确的 `UNIFYPORT_GATEWAY_ALLOWED_HOSTS` allowlist。
- 直接加载的 TLS certificate 和 key 文件。
- 可选的精确 origin allowlist，用于拒绝携带未批准 `Origin` header 的请求。

Gateway 不返回 CORS response headers，因此 origin allowlist 不会启用浏览器 CORS。它对 body size、headers、request timeout、keep-alive 和并发执行限制，不会把 MCP session 当作鉴权，也不会记录 request headers 或 bodies。OpenAPI facade 只包含同一组默认 3 个 tools，显式开启 writes 后为 4 个；它不是包含 64 个 operations 的原始 API。配置见 [.env.example](.env.example)，后端接入见 [Go 与 Python 示例](examples/README.zh-CN.md)。

## 生成与验证

生成产物只能沿单向流程流动：

```text
公开 SDK operation metadata
  + capability catalog 和数据分类策略
  -> 生成 capability manifest 和 runtime policy
  -> 生成双语任务型 Skills 和 operation references
  -> 共享 runtime、受控 CLI、MCP transports 和 adapter assets
```

当前流水线会对缺失或重复归属、不安全的策略放宽、缺少 secret-channel 分类、过期生成文件、损坏的双语链接和已知公开边界模式执行 fail-closed。Pattern matching 无法可靠识别上下文相关的私有信息和个人数据，因此仍必须人工评审。

当前 workspace 已实现的验证命令为：

```bash
pnpm capabilities:check
pnpm generate:check
pnpm docs:check
pnpm public:check
pnpm history:check
pnpm package:check
```

最终推荐执行 `pnpm check`，它会运行完整的已配置验证链。只有当前检出版本实际提供对应命令时才执行。CI 和 release metadata 是当前实现状态的权威来源。

## 默认安全策略

- Runtime 禁用 SDK retries。只有 policy metadata 允许且调用方设置严格上限时，调用方才可显式重试 read operation。
- 写操作没有 operation-specific 幂等保证时不得自动重试。
- destructive 或对外可见操作必须在执行前立即确认。
- Runtime 不会自动分页；调用方必须显式推进公开 cursor，并限制最大页数和最大条数。
- Provider-specific 限制必须作为 capability 或稳定错误返回，不能静默忽略。
- 最小化敏感响应字段，并从日志和模型可见输出中脱敏。
- Webhook 投递是异步流程，需要独立运行的 receiver；配置 endpoint 不会自动创建 receiver。

## 文档

- [架构](docs/architecture.zh-CN.md)
- [Adapter 支持](docs/adapters.zh-CN.md)
- [维护与契约同步](docs/maintenance.zh-CN.md)
- [公开安全边界](docs/security/public-boundary.zh-CN.md)
- [贡献指南](CONTRIBUTING.zh-CN.md)
- [安全策略](SECURITY.zh-CN.md)

## Roadmap

- 为已实现的 runtime 和 CLI/MCP package 发布经过验证的 npm artifacts。
- 在不弱化共享策略边界的前提下完成厂商侧 adapter 验证。
- 发布机器可读的 adapter 支持情况与 provider capability matrix。
- 增加 signed release provenance 和可复现 package 验证。
- 在不把 secrets 放入模型上下文的前提下扩展安全 platform integrations。
