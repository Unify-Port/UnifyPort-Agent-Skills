# 契约更新准备

[English](contract-update-plan.md) | [简体中文](contract-update-plan.zh-CN.md)

状态：仅完成策略准备。当前 catalog 仍为 64 个 operation、16 个 workflow，runtime 继续使用已发布的 `@unifyport/sdk-node` `0.1.3`。本次不开放新工具、不升级依赖、不发布，也不声称已经完成 78 个接口的 runtime parity。

## 候选 workflow

下列接口全部继续不可用，即使启用 write/destructive opt-in 也不能执行。离线测试锁定在调用 SDK 方法之前拒绝的边界。正式开放前须具备已发布的公开 SDK、明确的 workflow、字段分类及确认/安全通道测试。

| 候选 operation                                                                      | 建议 workflow | 必须审查的边界                                                                                                          |
| ----------------------------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `getAccountOperation`                                                               | 账号生命周期  | 操作状态不证明删除或退款完成；轮询需有界，不自动重新提交。                                                              |
| `createAccountAuthSession`、`submitAccountPasskeyResponse`、`confirmAccountPasskey` | 账号授权      | 显式 write approval；凭证输入使用引用，登录 URL 和授权材料仅进入 secure sink。                                          |
| `createContact`、`getContactMembership`                                             | 联系人目录    | 创建需 write 确认；分类手机号、username 及身份数据；不隐式重试。                                                        |
| `requestConversationHistory`                                                        | 会话历史      | 需 write 确认；异步 best-effort 事件不等于完整档案或可保证重放。                                                        |
| `listPosts`、`getPost`、`listPostComments`、`replyPostComment`                      | 帖子与评论    | 区分读取和回复写入；分类评论正文/作者数据；POST 读取仍遵守显式重试策略。                                                |
| `createCall`、`getActiveCall`、`hangupCall`                                         | 通话          | 同时验证服务端资格和 runtime 开关；拨打为 write，挂断为 destructive；短期 join URL 进入 secure sink，不自动拨打或重试。 |

## 既有字段迁移

审查余额字段及可选旧额度、建号幂等、删除 `202`/`204`、独立提交 `auth_mode` 切换、QR/Passkey 状态、渠道专用 session 导入及已读边界。可选数字错误码只属于过滤后的元数据，不得暴露上游 details。

24 个事件名与 36 个专用 payload 声明分开审查。保留稀疏更新、显式 false/0/空值、投票撤回和乱序通话终态。新字段分类完成前默认拒绝；收到 Webhook 不证明消费方落库。

## 开放门槛

1. 选择已发布的公开 SDK 版本，验证安装包内容；未发布的源码 checkout 不能作为本 runtime 的依赖。
2. 更新 canonical capability 和 data-classification 文件，一起重新生成 Skills、策略、schema 和 host adapter。
3. 验证 approval 绑定、write/destructive opt-in、secret reference、secure output reserve/commit/abort、脱敏、分页、幂等及禁止重试行为。
4. 运行 `pnpm check` 和安装包验证；任何发布或外部写入前另行准备评审。
