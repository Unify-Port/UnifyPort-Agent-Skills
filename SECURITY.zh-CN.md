# 安全策略

[English](SECURITY.md) | [简体中文](SECURITY.zh-CN.md)

安全是 UnifyPort Agent Skills 的 release 要求。请私下报告漏洞，以便维护者在细节公开之前完成调查。

## 报告漏洞

只要仓库支持，请优先使用本仓库的 **GitHub private vulnerability reporting**：

1. 打开仓库的 **Security** 标签页。
2. 选择 **Report a vulnerability**。
3. 私下提交报告。

对于尚未修复的漏洞、泄露凭证，或疑似暴露私有基础设施或个人数据的问题，不要创建公开 issue、discussion、pull request，也不要在社交媒体发布。

如果界面没有 private reporting 按钮，请使用 GitHub 提供的其他私有、仓库级安全通道。本策略不会发布未经确认的安全邮箱地址。

## 报告应包含的内容

只提供复现和评估问题所需的最少信息：

- 简明问题描述和预期安全影响。
- 受影响的 release、package、adapter、Skill 或生成产物。
- 使用合成数据和占位符的复现步骤。
- 问题是否影响 CLI、MCP、host adapter、生成流程、打包或公开契约。
- 相关安全分类：authentication、authorization、secret handling、模型可见输出、destructive confirmation、retry behavior、公开边界泄露或供应链。
- 如果已知，提供建议修复方式。

绝不能包含仍有效的 API Key、密码、session、signing secret、私有 URL、生产日志、真实账号标识符或个人数据。如果凭证可能已经泄露，请通过适当的安全流程撤销或轮换，并使用占位符描述事件。

## 响应流程

维护者会通过私有报告评估严重程度、复现问题、协调修复、检查下游 packages，并准备披露。响应和发布时间取决于影响与修复复杂度；本策略不承诺固定 SLA。

公开披露前，请给维护者合理的调查时间。双方可以在私有报告中约定 coordinated disclosure 细节。

## 支持版本

首个 stable release 之前，安全修复应用于仍在积极维护的 preview line。开始发布 stable releases 后，release notes 和 package metadata 会标明支持版本。除非安全公告另有说明，用户应升级到最新受支持版本。

生成文档或 Roadmap 文本不能证明某个 package 或 adapter 已受支持。

## 安全敏感区域

我们特别关注以下报告：

- API Key 或其他 secrets 进入 prompt、MCP arguments、日志、trace、错误、snapshot 或生成文件。
- 一次性 secret 输出被重复返回、缓存或暴露给模型。
- Destructive 或对外可见操作缺少确认。
- 写请求在没有经过评审的幂等保证时被自动重试。
- Operation 绕过任务型 Skill 归属或 adapter policy。
- 公开产物包含本机路径、私有 host、内部实现细节、凭证、生产数据或 PII。
- Contract sanitizer 或 generator 行为不确定，或出现 fail-open。
- Dependency、package、archive、provenance 或 release integrity 问题。
- Host adapter 绕过 host-native secret storage 或确认控制。

## 安全研究要求

- 只测试你获得授权的账号、workspace、endpoint 和数据。
- 优先使用本地 fixture、mock 和合成标识符。
- 不要进行 denial of service、批量消息、spam、破坏性群组或账号修改，也不要进行侵犯隐私的测试。
- 不要访问、保留或传播他人的数据。
- 如果遇到真实 secret 或个人数据，请停止测试并私下报告。

本仓库不承诺 bug bounty 或法律 safe harbor。如果未来发布了独立项目条款，应以该项目条款为准。

## 公开边界

仓库的数据分类和 release 规则见[公开安全边界](docs/security/public-boundary.zh-CN.md)。
