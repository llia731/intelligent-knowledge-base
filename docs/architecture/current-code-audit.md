# 现有代码详细审计：产品 V1.0 对接准备

日期：2026-11-04。核查仓库 main 快照 `bc0bf9914d65551a6283d81f26e5cf0e05c889dc`；本文件反映源码静态阅读，不代表已在运行环境通过端到端测试。

## 实际入口与能力

| 文件 | 代码依据 | 结论 | 迁移建议 |
|---|---|---|---|
| src/routes/_app/upload.tsx | `onFile()` 使用 `file.text()` 读取原始文本并截取 20,000 字符；`submit()` 依靠 280ms 的 setInterval 模拟四步进度 | PDF、Office 文件不能由此获得真正结构化内容，进度不代表后台完成 | 保留 UI，替换为真实文件上传、远端 MinerU 任务状态和索引完成事件 |
| src/lib/kb/chunk.ts | `chunkText()` 按段落与字符滑动窗处理，`scoreChunk()` 为词频和二元组命中 | 可作为简化对照，但不是结构感知分块，也不是 BM25 | 将算法放入服务端并新增独立 baseline；保留现有逻辑用于演示模式 |
| src/lib/kb/query.ts | `rankHits()` 遍历本地文档和 chunks，调用 `scoreChunk()`；`canReadDoc()` 依赖本地 accessRole 和 grants | 检索不通过独立全文引擎；权限依据来自客户端演示状态 | 建立搜索适配器和服务端 ACL，下推过滤后再召回 |
| src/routes/_app/ask.tsx | `hits()` 在前端查本地状态，`toCitations()` 后把 excerpts 发到 `askKnowledge()` | 证据由客户端提供，不能作为正式权限或可信引用边界 | 服务端直接检索已授权知识，再执行重排和问答 |
| src/lib/kb/ask.functions.ts | `createServerFn` 固定访问 x.ai `grok-4.5`；只消费客户端传递 contexts | 服务端函数存在，但缺少服务器端可验证的证据来源 | 替换为内网模型代理，输入仅保留提问及经授权的知识库作用域 |
| src/lib/kb/store.ts | `zustand/persist` 管理 docs、chats、reviews、users、keys、grants、acl、traces | 已有完整 UI 演示状态，但状态修改不等于正式后台事务 | 逐步拆分 UI 临时状态与真正服务端实体，避免一次性删掉演示页面 |
| src/lib/kb/types.ts | `Chunk` 仅 id/text/index；`Citation` 为 docId/title/excerpt/index | 缺少 document_version、page、block、source span 与索引版本 | 保持兼容扩展契约；不要直接改变原型可见字段 |
| src/lib/kb/access.ts | `DEFAULT_GRANTS`、`expandQuery` 为演示角色与同义词字典 | 可以保留交互展示，但不能独立承载正式鉴权 | 迁入服务端权限策略，并配置审计 |
| src/routes/_app/library.tsx | 读取 `useKb.docs`，回收与恢复通过本地 store，操作按钮完整 | 回收站不关联真实索引和文件生命周期 | 建立软删除、索引删除、恢复、版本及可见性同步 |
| src/lib/auth/server.ts | Better Auth、PostgreSQL、PGlite、Grok auth broker 的部署及预览分支 | **已有真实认证框架的代码基础**，但与原型 store 的演示角色尚未完成可靠融合 | 复用 Better Auth 代码边界，评估在内网摆脱外部 broker 的独立认证方式 |
| src/lib/auth/middleware.ts | `authMiddleware` 通过 `requireUserId` 验证服务端调用者 | 可复用的服务端身份取得机制 | 所有按用户或知识库访问的数据 API 必须使用，并进一步做角色授权 |
| src/lib/auth/isolation.server.ts | same-site 脚本请求隔离机制 | 适合保留，但原有安全背景面向 Grok 域，内网部署需实测 | 不删除已有保护；结合真实来源域名与 CSRF 策略验证 |
| migrations/auth/0001_auth.sql | 只定义 user/session/account/verification 等认证表 | 已有基础认证 schema，但**没有发现正式知识文档和索引迁移文件** | 新建业务 schema，认证迁移不直接手工修改 |
| scripts/migrate.mjs | `DATABASE_URL` 触发 PostgreSQL 迁移；无连接时跳过 | 已有迁移脚手架，注意 auth 子目录不在默认递归扫描范围内 | 确认部署迁移入口和 schema 初始化责任 |
| src/lib/app-data/client.server.ts | 外部 Grok 连接器代理及预览 token 处理 | 该系统属于原来演示环境的集成基础设施，**不是实际 MinerU 或模型网关适配器** | 不直接沿用该专有服务连接方式；新增受控的内网 HTTP 适配器 |

## 高优先级问题

1. **服务器端来源和权限验证不足**：问答请求把客户端组装的 contexts 交给服务端 LLM；生产逻辑必须在服务器验证权限并自行读取真实证据，避免未授权文本被模型使用。
2. **上传与任务状态不真实**：现有定时进度不能直接迁移为后台进度。改为上传成功、解析中、待审核、索引中、索引完成、失败及重试等状态；具体审核时序需按墨刀原型确认。
3. **示例状态与真实数据混用风险**：`zustand/persist` 以及 demo users/keys/ACL 只属于原型；生产环境禁止用客户端本地状态作为授权事实来源。
4. **现有认证实现不可直接假定可用于内网**：Better Auth 框架值得保留，但当前代码与 `GROK_AUTH_ISSUER`、预览 broker、`VITE_AUTH_ENABLED` 存在关联。内网真实登录方式须根据项目人员管理要求决策。
5. **文档索引一致性缺口**：审核、撤权、版本变更、删除、恢复需要明确在检索前立即生效的策略；不依赖后台重建完成才停止暴露不可见内容。
6. **搜索结果显示的相似度是展示换算值**：search.tsx 使用 `Math.min(0.98,0.72 + score/40)` 显示“相似度”，不是真实模型的相似度或 BM25 值。真实接入时必须换成正确指标或只显示相关性排序。

## 下一步验收与测试建议

- 基线测试：`npm run typecheck`、`npm run test`、`npm run build`，在独立环境运行，记录成功与失败，不在本次静态审计中声称通过。
- 按原型逐屏：访问入口、页面元素、表单校验、空结果、失败、审核、回收站与授权场景。
- 安全负例：伪造 contexts、不传授权集合、撤权后查询、删除后查询、跨用户 session。
- 架构迁移：抽象 `KnowledgeRepository`、`AuthorizedRetrievalService`、`IngestionJobService`，并保证原有 React 路由不因检索引擎选型变化而重做。

## 核查边界

本轮读取了上述关键文件的代码内容，尚未逐屏解析二进制墨刀 ZIP，也未运行 Node 构建及服务器容器；对正式数据库和登录方式的最终判断需要内网执行和产品负责人确认。