# 维护与发布指南

[English](maintenance.md) | [简体中文](maintenance.zh-CN.md)

## 范围

本文定义维护者如何同步公开契约、重新生成产物、保持 64-operation 与 16-Skill 覆盖、验证公开边界并发布 releases。

## 当前状态

当前 workspace 已实现六个聚焦检查：

```bash
pnpm capabilities:check
pnpm generate:check
pnpm docs:check
pnpm public:check
pnpm history:check
pnpm package:check
```

`pnpm check` 会把这些检查与 workspace 配置的格式、lint、测试、type check 和 build 一起执行。共享 runtime、受控 CLI、stdio MCP、Streamable HTTP/OpenAPI gateway 和 adapter source 已实现并通过本地测试，但 npm packages 尚未发布。完整 standalone-contract sanitization、standalone-contract structural parity 和厂商托管环境 adapter validation 不能描述为当前能力。

## 权威来源

| 产物                          | 权威范围                                                   | 可以手工修改吗？          |
| ----------------------------- | ---------------------------------------------------------- | ------------------------- |
| 固定版本的公开 SDK dependency | 公开 operation 和 wire metadata                            | 只能评审后修改版本        |
| Capability catalog            | 16-Skill ownership、access、confirmation 和 channel policy | 可以，但需评审            |
| 数据分类策略                  | 受保护 input/output pointers 和 fail-closed 默认值         | 可以，但需安全评审        |
| Host adapter inventory        | 经过评审的交付模式和目标 metadata                          | 可以；厂商 E2E 需单独验证 |
| 生成 capability manifest      | 合并后的公开 operation 和 workflow metadata                | 不可以；由生成产生        |
| 生成 core policy catalog      | Runtime 可消费的 operation 和 data policy                  | 不可以；由生成产生        |
| 生成双语 Skills 和 references | 任务说明与 operation mapping                               | 不可以；由生成产生        |
| 英文与中文治理文档            | 公开说明                                                   | 可以，必须同时修改        |

非公开 contract input、source location 和 synchronization artifact 不得提交、缓存到公开 CI artifacts、打印到日志或放入 package archives。

## Operation catalog 同步

在干净 workspace 中评审公开 SDK dependency 更新。不能为了执行更新而把非公开 source material 复制到仓库。

### 1. 加载公开 metadata 和经过评审的策略

- 从固定版本的公开 SDK 加载 operation inventory。
- 按结构加载 capability catalog 和数据分类策略。
- 保持 data policy 默认值为 `internal_only`，防止新字段自动进入模型可见范围。
- 将每个公开 SDK operation 唯一分配给一个任务型 Skill。
- 对每个变化的 operation 评审 access、confirmation、channel 和 classified data pointers。
- 仓库内容只能使用合成 placeholders 和保留 example domains。

### 2. 扫描公开产物

当前 `public:check` 检测已知用户 home 路径、private-network URL、internal-route pattern、source-provenance metadata、常见 credential shape、symbolic link 和禁止的 JavaScript module 文件。它扫描仓库文本，包括已经存在的生成或 build output。

Scanner 只是 guardrail，不负责决定内容是否可公开。Reviewers 仍必须拒绝 pattern matching 可能漏掉的上下文相关私有实现细节、类似生产环境的 identifiers、手机号、邮箱、姓名、消息内容、日志、截图和其他 PII。

### 3. 验证 catalog 一致性

`pnpm capabilities:check` 将 catalog 与公开 SDK 导出的每个 operation 比较，并验证安全关系。当前 inventory 必须满足：

```text
operation count = 64
unique operationId count = 64
workflow count = 16
missing SDK assignments = 0
duplicate catalog assignments = 0
```

如果任一预期数量变化，停止常规更新，并执行下文的 API change 流程。

## 生成

Capability validation 通过后：

1. 执行 `pnpm generate`。
2. 评审生成 capability manifest 和 core policy catalog。
3. 评审 16 个 workflows 各自生成的四份双语 Skill/reference 文件。
4. 执行 `pnpm generate:check`，要求不存在缺失或过期输出。
5. 执行 `pnpm docs:check` 和 `pnpm public:check`。

安装依赖之后，生成过程是确定且离线的。它不能调用真实 API、读取 `UNIFYPORT_API_KEY`，也不能包含 environment-specific value。

## Skill 覆盖验证

每个公开 operation 必须恰好有一个任务型 Skill owner。当前不变量是 16 个 Skills 覆盖 `64/64`。

每个 operation 都必须包含 access、confirmation 和 channel catalog metadata。Validation 将这些信息与公开 SDK 的 method、path、mutability、retryability、secret-input 或 secret-output flags 结合；需要安全通道时还要包含 classified data pointers。

当 secret operation 的 channel 是 `secure_input`、`secure_output` 或 `secure_input_output` 时，仍必须计入覆盖。不能为了让未来 MCP 覆盖看起来完整而删除 operation。

## 测试矩阵

Release 至少必须验证：

### 当前 catalog 与 generator

- Catalog 和 data-policy schema versions 受支持。
- 64 个 SDK operations 在 16 个 workflows 中各有一个 owner。
- Mutability、confirmation、secret-channel 和 classified-pointer 关系通过。
- 生成可复现，且每个预期生成文件都是最新版本。

### 当前文档与公开边界

- 每个 Markdown 文档都有双语 counterpart 和语言导航。
- 本地 Markdown links 可解析，生成 Skills 具有有效 frontmatter。
- 已知 local-path、private-network、provenance、key-material、token 和 hard-coded-secret patterns 会使公开扫描失败。
- Symbolic links 和禁止的 JavaScript module 文件会使公开扫描失败。

### 当前 runtime、transports 与 adapters

当前源码测试覆盖 API Key 注入与脱敏、稳定 response shaping、permission switches、confirmation、模型 secret 隔离、安全引用与 output sink、固定 MCP/OpenAPI allowlist、Streamable HTTP 与 tool-call 鉴权、public bind 拒绝，以及受保护目录安装。每次 SDK invocation 都使用 `retry: false`，runtime 不会自动分页。后续变更必须保持 request timeout、调用方可见的 retry/pagination guidance、request-ID 传播、不受支持 capability 报告和准确异步状态。

本地 adapter tests 验证生成 assets、经过评审的目标目录、冲突行为、path containment 和 symbolic-link rejection，不能证明厂商托管环境端到端行为。TRAE、Dify 和 Coze 必须保持 manual/platform integration 分类；只有 8 个经过评审的目录 hosts 可以使用 `unifyport-agent install`。

### 公开 package 与 history 边界

公开 release review 包含四个彼此独立的 surface：

1. 扫描 source tree，包括 tests、examples 和文档。
2. 重新生成并扫描 generated/build output，不能只信任 source input。
3. 执行 `pnpm package:check`，build、pack、list、安全 unpack、validate 并重扫描两个 npm tarballs。
4. 执行 `pnpm history:check` 扫描完整 patch history；删除 working-tree file 不会清除历史内容。

`public:check` 扫描仓库文本，并覆盖已经存在的 generated/build output。`package:check` 构建两个可发布 packages，pack 并安全 unpack tarballs，校验 package manifests 和 entry points，再对展开内容运行相同公开扫描。`history:check` 扫描完整 Git patch history。这些是彼此独立的 gates；只扫描干净 source tree 不足以完成验证。文本 scanner 仍跳过包含 NUL 的 binary content，因此 package type/path validation 和人工评审仍不可缺少。

## 公开 API 变更流程

经过评审的公开 SDK 变更新增、删除或修改 operation 时：

1. 记录兼容性评估和经过评审的 SDK dependency 变化。
2. 执行 `pnpm capabilities:check`；新 SDK operation 应先以未分配状态失败。
3. 为每个新 operation 唯一分配一个任务型 Skill。
4. 评审 access、confirmation、channel 和 data-pointer classification。
5. 重新生成 manifest、policy catalog、Skills 和 references。
6. 更新两种语言的文档。
7. 执行完整的已配置验证链。
8. 决定合适的 semantic version 变化。
9. 对 breaking change 发布迁移说明。

不能为了简化 agent behavior 而从 capability catalog 删除公开 operation。应保留 operation ownership，并通过 policy metadata 和 adapters 执行 channel restriction。

## 依赖维护

- 优先使用经过评审、固定范围的 dependencies，并提交 lockfile。
- 评审 install scripts、transitive dependency changes 和 package provenance。
- 更新后运行完整测试与公开边界 suites。
- 避免 generator 在运行时下载未固定版本的 executable。
- 将 SDK、YAML parser、HTTP、MCP、archive 和 build-tool dependencies 视为安全敏感项。

## Release 检查清单

- [ ] 必需验证命令存在且通过。
- [ ] SDK operation count 和 capability-catalog coverage 符合预期。
- [ ] 生成可复现，并且没有未提交 diff。
- [ ] 所有 operations 都有唯一任务型 Skill owner。
- [ ] 源码已实现的 runtime 与 adapters 真实存在并经过测试；未发布和厂商验证边界已明确说明。
- [ ] Secret 和 destructive-operation 策略已经评审。
- [ ] 英文和简体中文文档语义一致。
- [ ] Source 和生成输出通过公开边界扫描。
- [ ] `pnpm package:check` 对两个 npm tarballs 及其展开 payload 通过。
- [ ] `pnpm history:check` 对完整 patch history 通过。
- [ ] 不含凭证、本机路径、私有 host、内部细节、生产数据或 PII。
- [ ] Current status 和 Roadmap 措辞与实际发布内容一致。
- [ ] Version、changelog 和 migration notes 已准备完成。

## 安全发布

通过 GitHub 私有安全流程处理漏洞。在 coordinated release 准备好之前尽量减少 patch 信息公开，扫描所有下游 artifacts，并通过适当的私有流程轮换可能暴露的测试或服务凭证。绝不能把包含 secrets 或 PII 的 incident evidence 放入公开仓库。

## Roadmap

- 如果引入公开 contract artifact，增加经批准的 standalone-contract sanitization 和 structural parity checks。
- 为每个 release 发布带厂商验证状态的经过测试 adapter support manifests。
- 为 release artifacts 发布 signed checksums 和 verifiable provenance。
- 在当前双语结构检查基础上增加 semantic-drift validation。
- 增加带 freshness metadata 的机器可读 provider capability snapshots。
