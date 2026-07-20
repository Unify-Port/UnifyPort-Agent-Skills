# 为 UnifyPort Agent Skills 贡献

[English](CONTRIBUTING.md) | [简体中文](CONTRIBUTING.zh-CN.md)

感谢你帮助改进 UnifyPort Agent Skills。只要变更能够保持公开安全边界、确定性生成、精确 operation 覆盖和双语文档一致，我们欢迎贡献。

## 开始之前

- 阅读[架构](docs/architecture.zh-CN.md)、[维护指南](docs/maintenance.zh-CN.md)和[公开边界策略](docs/security/public-boundary.zh-CN.md)。
- 使用当前检出版本声明的 package manager 和 runtime 版本。
- 将某个 adapter 视为已实现之前，先检查当前 release 中是否真实存在对应 package、entry point 和 tests。
- 如果发现漏洞或疑似 secret 泄露，不要创建公开 issue；请遵循 [SECURITY.zh-CN.md](SECURITY.zh-CN.md)。

## 本仓库允许包含的内容

适合提交的内容包括：

- 任务型 Skill 指令和安全元数据。
- 从公开 API 契约派生的共享运行时行为。
- 确定性 generator、公开边界 scanner 和 parity check。
- 能够执行共享策略的 CLI、MCP 和 host adapters。
- 测试、公开示例和双语文档。

不要加入本机文件路径、私有仓库细节、私有路由或 host、服务拓扑、凭证、session 材料、生产日志、真实标识符或个人数据。请使用 `<api-key>`、`<account-id>`、`https://example.invalid/callback` 等经批准的占位符。

## 开发流程

1. 从最新分支开始，并保持变更聚焦。
2. 判断变更影响公开契约、生成产物、任务型 Skill、adapter 还是文档。
3. 修改源文件，不直接修改生成产物。
4. 为行为、安全分类和失败场景增加或更新测试。
5. 同时更新英文和简体中文文档。
6. 执行当前检出版本提供的验证命令。
7. 创建 pull request，说明用户结果、安全影响、生成变化和验证证据。

不要提交 secrets，也不要在测试、snapshot、示例、截图或 issue 描述中使用真实客户数据。

## 公开 operation 变更

当前 operation inventory 从公开 SDK metadata 加载。即使只是临时文件，也不能把非公开 contract、source location 或 synchronization artifact 复制到本仓库，因为 Git 历史会永久保留内容。

除非经过明确评审的公开 API 版本修改了契约，否则公开 SDK dependency 或 capability catalog 变更必须保持以下不变量：

- 每个 operation 都有唯一 `operationId`，并且只有一个任务型 Skill owner。
- Catalog access classification 不能弱化公开 SDK 的 mutability classification。
- Secret input 和 output 声明必须映射到经批准的安全通道和已分类 data pointers。
- 本机路径、私有 host、实现细节、凭证和个人数据不得进入公开产物。

当前 inventory 包含 64 个 operations。如果数量发生变化，pull request 必须说明公开 API 变化、更新 capability catalog 和 data policy、重新生成 artifacts，并包含明确的兼容性评审。

## 生成文件

生成的类型、operation metadata、adapter manifests 和覆盖报告必须可复现，禁止手工修改。

标准检查为：

```bash
pnpm capabilities:check
pnpm generate:check
pnpm docs:check
pnpm public:check
```

执行 `pnpm check` 可运行完整的已配置验证链。只执行当前版本实际存在的命令。如果缺少必需检查，这属于 release blocker，不能作为跳过验证的理由。

## 任务型 Skill 归属

所有公开 operations 必须唯一映射到 16 个任务型 Skills 之一。新增或移动 operation 时：

- 更新机器可读的 ownership manifest。
- 除非公开契约本身变化，否则保持 `64/64` 覆盖。
- 对遗漏或重复归属直接失败。
- 通过跨 Skill prerequisite 描述依赖，不要把同一个 operation 复制进多个 Skills。
- 即使某个含 secret 的 operation 只能通过 CLI 或 host 安全通道执行，也必须保留在覆盖范围内。

Skill 指令必须标识 read、write、destructive、secret、human-in-the-loop、asynchronous 和 provider-limited 行为。高影响操作必须在执行前设置即时确认 gate。

## Adapter 规则

- Adapter 必须调用共享运行时，不能各自创建行为不同的 HTTP client。
- MCP 只能暴露 model-safe 输入和输出。
- CLI 必须通过环境变量、受保护的标准输入或经批准的 secret store 接收 secrets，不能使用普通命令参数。
- Host adapters 应在可用时使用 host-native secret 和确认能力。
- 不支持的 capability 必须返回明确的 unsupported 状态，不能伪造成功。
- 未经幂等保证评审，写操作不得增加自动重试。

## 文档语义一致

每次公开治理或架构变更都必须在同一个 pull request 中更新英文和简体中文版本。两种语言必须表达相同含义、安全要求、当前状态和 Roadmap 边界。不要求逐句直译，但不能遗漏内容。

## Pull request 检查清单

- [ ] 变更范围聚焦，没有包含无关生成产物。
- [ ] 不含 secret、私有基础设施细节、本机路径、生产数据或 PII。
- [ ] 适用时，公开 contract 和 operation-lock 检查通过。
- [ ] 所有 operations 仍保持唯一任务型 Skill 归属。
- [ ] Read/write/destructive/secret/HIL/async/provider metadata 正确。
- [ ] CLI、MCP 和 host 继续通过共享运行时保持一致行为。
- [ ] 测试覆盖成功路径、稳定 API 错误和安全失败。
- [ ] 英文与简体中文文档语义一致。
- [ ] Current status 和 Roadmap 项目没有被描述为已完成功能。

对于 contract、generator、authentication、secret channel、destructive action 或 release 变更，维护者可能要求额外的公开边界评审。
