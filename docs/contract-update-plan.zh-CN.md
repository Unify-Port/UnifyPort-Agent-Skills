# 契约升级验证

[English](contract-update-plan.md) | [简体中文](contract-update-plan.zh-CN.md)

runtime 使用已发布的 `@unifyport/sdk-node@0.5.0`，78 个操作归属 18 个工作流。Agent packages 仍未发布。Skill、策略和 adapter 来自同一 catalog；MCP 默认 3 个工具，开启写入后 4 个。

账号生命周期覆盖有界分页、调用方自持的创建 Idempotency-Key 和删除返回 202 后的 operation 查询；兼容 204，不虚构 operation ID。授权加入 auth session 和 Passkey；provider data、proxy、protocol 对象通过 JSON secret reference 注入，WebAuthn 响应保持受保护的序列化字符串。创建/更新的 provider profile、发送 reply token、授权材料与通话 join URL 必须先预留 secure sink。

帖子评论、通话分别拥有独立工作流；POST 读取仍按只读处理。发起通话需要写入确认，挂断还需 destructive 开关和风险确认；服务端 private beta 资格仍然适用。历史请求为异步 best effort，不保证重放；不确定写入禁止自动重试。

Facebook 仅支持 session 创建/导入。选择可分配 region，通过 secret reference 提供短时受控 session URL；授权后单独检查 runtime。仅 running 时使用 E2EE user 会话的原始字符串 ID 发送单条文本或单个媒体；audio 为部分支持。不因 provider 枚举扩展群、引用、mentions、caption、消息操作、联系人、帖子评论或通话能力。

已发布契约有 24 个事件名。FB 使用既有四类回调：message.received 可能为入站或出站；account.auth.succeeded 后须查询 runtime；account.status.updated 的 runtime error 不等于授权撤销；account.auth.failed 单独处理。保留稀疏字段、false/zero、字符串 ID 与时间精度；原生媒体 duration 单位未确认。

运行 `pnpm check`，覆盖生成漂移、公开边界、测试、类型与打包消费验证。离线验证与真实账号交付分开验收；发布需另行授权。
