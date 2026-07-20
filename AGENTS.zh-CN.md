# 仓库开发约束

[English](AGENTS.md) | [简体中文](AGENTS.zh-CN.md)

## 公开边界

- 本仓库对外公开，只能使用已批准的 Device API 公开契约和已发布的公开包。
- 禁止加入私有仓库名、本机路径、内部路由、私有 host、源码来源信息、凭证、个人数据、客户数据或形似真实 secret 的示例。
- 不得先复制内部契约再删除敏感内容；敏感值从一开始就不能进入 Git 历史。
- `UNIFYPORT_API_KEY` 只能通过带外配置提供，禁止进入 prompt、tool 参数、日志、snapshot、生成文件和错误信息。

## 真源

- `capabilities/catalog.yaml` 负责 64 个 operation 到 16 个 Skill 的映射与操作风险策略。
- `policies/data-classification.yaml` 负责字段处理与安全通道规则。
- `skills/` 是唯一 Skill 真源；各平台 adapter 由生成器产生，禁止手改生成副本。
- 生成文件必须通过来源文件和生成器修改。

## 开发

- runtime 和 tooling 使用 TypeScript，不新增 `.mjs` 文件。
- 英文与简体中文文档必须语义完整对应。
- 注释使用简短中文，仅说明意图、边界、兼容、外部限制或风险，不复述显而易见的代码。
- 新 operation 和新字段默认拒绝，只有补齐 workflow 与数据策略后才能开放。
- 默认仅开放只读工具；写操作和破坏性操作需要独立 runtime opt-in；secret 输入使用引用，secret 输出进入安全 sink。
- 对外交付前运行 `pnpm check`，任何无法执行的检查都必须明确说明。
