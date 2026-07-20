# 公开安全边界

[English](public-boundary.md) | [简体中文](public-boundary.zh-CN.md)

## 目标

本策略定义哪些内容可以进入公开仓库、生成 packages、文档、日志和模型可见 adapter surface。它适用于 source files、Git history、生成输出、测试、fixtures、snapshots、build artifacts、source maps、package archives、release notes、issues 和 pull requests。

本策略采用 fail-closed：除非内容经过明确批准可以公开，否则一律视为私有。

## 当前状态

Capability catalog 通过 16 个任务型 Skills 覆盖 64 个公开 SDK operations。Operation coverage 与 channel exposure 是两个不同概念：当某个 operation 的策略要求 secure input 或 output、不能作为原始模型可见 tool 暴露时，它仍必须保留在覆盖范围内。

当前仓库已实现 catalog、生成文件、双语文档和公开 pattern 检查，以及共享 runtime、受控 CLI、stdio MCP、Streamable HTTP/OpenAPI gateway、adapter source、自动 npm-tarball expansion/scanning 和完整 Git patch-history scanning。这些 packages 已在源码中实现并测试，但尚未发布到 npm。完整 standalone-contract sanitization/parity 和厂商托管环境 adapter validation 不属于当前能力声明。自动检查只能补充人工评审；scanner 通过不代表违反本策略的内容获得公开授权。

## 允许公开的内容

公开产物可以包含：

- 公开 SDK operation metadata；如果以后引入公开 contract artifact，则还可以包含经批准、清理后的产物。
- 公开 operation IDs、公开 methods 和 paths，以及公开请求或响应 schemas。
- 任务型 Skill 名称、安全分类、provider limitations 和 adapter support status。
- 确定性 generators 和公开验证逻辑。
- 使用明显占位符和保留 example domain 的合成示例。
- 公开 package metadata、changelogs、release notes 和治理文档。
- 已脱敏的错误示例，以及不会被误认为生产数据的虚构 identifiers。

请使用以下占位符：

```text
<api-key>
<one-time-code>
<session-payload>
<signing-secret>
<workspace-id>
<account-id>
<conversation-id>
<message-id>
https://example.invalid/callback
```

占位符应说明数据类型，但不能保留真实 secret 或 identifier 的形状和值。

## 禁止公开的内容

绝不能提交或发布：

### 私有工程与基础设施信息

- 本机文件路径、用户名、home directory、editor state 或 workspace layout。
- 私有仓库名称、位置、branch、commit、source manifest 或 issue link。
- Internal-only route、service name、host、port、network topology、deployment detail 或 observability endpoint。
- 会暴露非公开架构的私有实现说明、stack trace、source excerpt 或日志。

### 凭证与安全材料

- API Key、access token、密码、验证码、session、cookie、private key、signing secret、proxy credential 或 cloud credential。
- 从任何真实环境复制的有效或已过期凭证。
- 可能被误认为真实凭证或由真实凭证派生的 token-shaped 示例。
- Prompt、MCP payload、trace、snapshot、命令参数、shell history 或错误消息中的 secret value。

### 生产与个人数据

- 真实姓名、手机号、邮箱、头像、地址、contact card、消息内容或成员名单。
- 真实 workspace、account、provider account、conversation、contact、group、message、event、webhook 或 request identifier。
- 生产 URL、webhook destination、日志、analytics、截图、数据库记录或 support transcript。
- 虽然经过 pseudonymization，但仍可关联到个人或客户的数据。

## 数据分类

| 分类                    | 示例                                           | 公开仓库       | 模型可见 MCP/OpenAPI       | 安全 CLI/host                   |
| ----------------------- | ---------------------------------------------- | -------------- | -------------------------- | ------------------------------- |
| Public contract         | 经批准的 schemas 和 operation IDs              | 允许           | Model-safe 时允许          | 允许                            |
| Operational metadata    | Request ID、status、有界 pagination cursor     | 只允许合成示例 | 必要且已脱敏时允许         | 允许                            |
| Sensitive business data | 联系人、消息、群成员关系                       | 仅合成数据     | 只提供当前任务所需最少数据 | 经授权使用时允许                |
| Secret input            | API Key、密码、验证码、session、signing secret | 禁止           | 禁止作为原始字段           | 可通过受保护通道输入            |
| One-time secret output  | 新签发 API Key 或同类数据                      | 禁止           | 禁止                       | 只通过授权 secure sink 写入一次 |
| Private implementation  | 内部拓扑、source location、私有日志            | 禁止           | 禁止                       | 不属于本公开产品范围            |

## 通道策略

### API 鉴权

任何使用 `UNIFYPORT_API_KEY` 的 runtime 或 adapter 都必须从进程环境或经批准的 host secret store 读取它。绝不能将值作为普通 tool parameter、prompt value、普通 CLI argument 或提交的配置值接收。

这类运行时可以报告鉴权是否已经配置，但不能回显值或任何可逆表示。

### MCP 与 OpenAPI facade

MCP 是模型可见边界。Tool schemas、calls、results、traces 和 errors 都不能包含原始 secrets。已实现 server：

- 默认只暴露 `getWorkspace`、`listApiKeys` 和 `listProviderRegions`。
- 只有精确设置 `UNIFYPORT_ALLOW_WRITES=true` 时才增加 `updateApiKeyStatus`。
- 其余 60 个 operations 只保留在受控 CLI/Skill surface，不注册为模型工具。
- 通过 `GET /openapi.json` 和 `POST /tools/<tool-name>` 向 OpenAPI consumers 投影完全相同的 registry。
- 在 stdio、Streamable HTTP 和 OpenAPI tool calls 上都要求脱敏 output 和稳定公开错误。

MCP/OpenAPI adapters 不能为了增加 tool 数量而降低 operation 分类。完整 64-operation coverage 不代表必须提供 64 个 MCP tools 或 64 个原始 OpenAPI routes。MCP 与 tool-execution requests 必须使用 Bearer 鉴权；获取 schema 不执行 Device API operation。

### CLI

受控 CLI 可以处理含 secret 的 operations，但必须使用：

- 环境变量提供 API 鉴权。
- 经过校验的环境引用提供额外 secret input。
- Adapter 提供时使用经批准的操作系统或 host secret store。
- 使用全新、预留且绝不覆盖的 `0600` 文件保存一次性 secret output。

Secrets 不能出现在普通 arguments、verbose logs、stack traces、telemetry 或 shell completion data 中。

### Host adapters

目录 installers 只复制 canonical Skill assets，不获得 secret 访问权。它们是非提权、当前用户范围的工具：禁止使用 `sudo`，也禁止在其他 OS user 可修改的目录中运行。POSIX ownership 和 mode 检查会在写入前及写入过程中执行该边界；无法提供同等 filesystem isolation 的 host 必须在可信 user scope 内手工导入。OpenClaw 遵循自身 CLI trust lifecycle，TRAE 是手工导入，Dify 作为 Streamable HTTP MCP provider 直接连接，Coze 消费 policy-gated OpenAPI facade。Dify 和 Coze 是 platform integrations 而不是原生 Agent Skills。如果 host 或 platform 无法保证 secret 与模型上下文、日志隔离，必须禁用对应 operation 或引导到受控 CLI。

确认与 secret handling 是两件独立事项。持有安全值不代表获得 destructive operation 授权；adapter 仍必须获取要求的确认。

## Operation 安全策略

当前 catalog 记录 access、confirmation 和 channel classification。生成过程将这些字段与公开 SDK mutability、retryability、secret-input 或 secret-output flags，以及 classified data pointers 合并。

任何发布的 runtime 或 adapter 都必须执行以下行为：

- Destructive action 在执行前立即展示解析后的目标和后果。
- 对外通信要求明确用户意图或范围严格、预先批准的自动化策略。
- 每次 runtime SDK invocation 都使用 `retry: false`；调用方只能在严格自有边界内重试 policy 允许的 read。
- 写操作在没有经过评审的幂等保证时不得自动重试。
- 异步结果使用准确的 accepted 或 pending 措辞。
- Provider 不支持时返回明确 unsupported result。
- Runtime 不会自动分页。调用方必须显式推进公开 cursor，并限制 pagination/polling；adapter 支持 cancellation 时也必须可取消。

## Contract 清理边界（Roadmap）

本仓库当前没有发布 standalone contract sanitizer。如果以后引入公开 contract artifact，原始 input 只能在受控、临时的同步环境中处理。绝不能先提交再清理，因为后续删除不能从 Git history 中移除内容。

Sanitizer 必须：

1. 解析结构化输入。
2. 只应用 reviewed pointer-level overrides。
3. 保持受保护 wire 字段。
4. 用批准的 placeholders 替换不安全示例。
5. 对未知文档变化拒绝并要求人工评审。
6. 扫描最终 contract 和所有生成产物。
7. 输出确定性结果。

Sanitization 不能因为某个公开 field 或 operation 对 MCP 不安全就删除它。应保持 wire contract 准确，并在 policy metadata 和 adapters 中执行 channel restriction。

## 自动验证

当前自动检查覆盖：

- Catalog schema、16 个 Skills 的 `64/64` 唯一 ownership、mutability、confirmation、secure-channel 和 classified-pointer 关系。
- 确定性生成文件 freshness。
- 双语 Markdown counterpart、语言导航、本地链接和 Skill frontmatter。
- Source 和当前已有 generated/build text 中已知 filesystem path、private-network URL、provenance metadata、key material、access token、JSON Web Token 和 hard-coded secret assignment patterns。
- Symbolic links 和禁止的 JavaScript module 文件。
- `package:check` 会 build、pack、安全 unpack、校验 manifest/entry point 并重扫描两个可发布 npm packages。
- `history:check` 会扫描完整 Git patch history，包括 commits 中保留的已删除内容。

公开 release approval 必须分别评审四个边界：source、generated output、展开后的 npm tarballs 及其 publication lists，以及相关 Git history。每个边界都必须拒绝真实本机文件路径、私有或内部实现细节、凭证或类似凭证的值、生产/客户数据和 PII。

`public:check`、`package:check` 和 `history:check` 已自动覆盖这四个边界，但任何 scanner 都不能可靠发现所有上下文相关 PII 和私有实现细节。文本 scanner 也会跳过包含 NUL 的 binary content，并且不能证明 standalone-contract structural parity。人工 release review 仍必须覆盖：

- 包含 reviewed fixtures 的 high-entropy、PII 和 production-identifier heuristics。
- 对批准 secret placeholders 的 exact assertions。
- 引入 standalone public contract 时执行完整 contract tuple 和 structural parity。
- 检查 MCP/OpenAPI schema、call、result、trace 和 error 中的 secret fields。

Scanner finding 必须经过评审。不要用宽泛 ignore rule 压制问题；应使用最小范围的 reviewed exception，并说明内容为何可公开。

## 例外

例外需要明确的 maintainer 和 security review。例外必须范围最小、可记录、可测试，并在适当时设置期限。任何例外都不能授权公开凭证、个人数据、原始私有 contract 或私有基础设施细节。

## 事件处理

如果禁止内容进入工作分支或 artifact：

1. 停止发布和分享。
2. 通过 GitHub private vulnerability reporting 报告事件。
3. 通过私有流程撤销或轮换受影响凭证。
4. 从 artifacts 中删除数据；必要时在公开发布前协调 Git-history remediation。
5. 扫描相关 branches、archives、caches 和已发布 packages。
6. 增加 regression test，但不能复制已经暴露的值。

不要把含 secrets 或 PII 的 incident evidence 粘贴到公开 issue 或 pull request。

## Roadmap

- 如果引入 contract artifact，实现 standalone-contract sanitizer 和 structural parity gates。
- 增加上下文相关 PII 和 high-entropy fixtures，但不能复制真实数据。
- 增加双语公开边界 drift 自动检查。
- 增加 host 对 secret isolation 和 confirmation support 的 capability attestation。
- 发布机器可读的公开 data-classification schema。
