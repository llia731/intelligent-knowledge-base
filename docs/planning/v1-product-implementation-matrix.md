# 智能知识库 V1.0 产品实现矩阵（初版）

> 定位：墨刀 V1.0 是既定产品原型；本文件用于建立“原型需求—现有代码—实际服务—验收”的追踪关系。技术实现可升级，不得未经确认擅自改变产品范围。  
> 核查依据：仓库 main 的 README、docs/product-analysis.md、src/routes/_app 目录、src/lib/kb/chunk.ts、query.ts、ask.functions.ts、package.json。  
> **核查限制**：本轮确认了 prototype/智能知识库V1.0.zip 存在，但尚未逐屏解包核对原型中的每一个按钮、字段及弹窗；以下为代码与产品分析文档支持的一级矩阵，逐屏验收仍需补做。页面文件存在不等于业务已可用。

## 功能对应清单

| 产品功能 | 当前代码入口 | 已核实事实 | 需要完成的服务能力 | 验收要点 | 状态 |
|---|---|---|---|---|---|
| 首页、工作台 | src/routes/_app/index.tsx | 已有页面文件 | 数据统计、最近活动、快捷入口的真实服务 | 与墨刀页面、数值和导航一致 | 页面存在；业务待核 |
| AI 问答 | src/routes/_app/ask.tsx；src/lib/kb/ask.functions.ts | 问答服务函数当前使用 x.ai 的 grok-4.5；入参为前端传入的 contexts | 服务端检索、内网模型、会话持久化、流式输出、证据引用 | 不从未授权材料生成回答；引用指向真实证据 | 简化实现 |
| 智能检索 | src/routes/_app/search.tsx；src/lib/kb/query.ts；chunk.ts | rankHits 使用词项命中评分，并非 BM25；未形成真实向量检索 | BM25、Dense、融合、重排、过滤、查询日志 | 可观察各阶段命中和结果来源 | 简化实现 |
| 知识上传 | src/routes/_app/upload.tsx | 页面文件存在；README 标明尚未接入真实 PDF、Office 解析 | 文件存储、MinerU 异步解析、队列、重试和状态同步 | 任务完成后可检索；失败有可解释状态 | 页面存在；解析待建 |
| 知识管理 | src/routes/_app/library.tsx | README 描述审核、删除、回收站等原型流程与本地保存 | 服务端文件、版本、索引一致性、删除和恢复 | 删除或撤权后无法被检索 | 待真实后端核验 |
| 权限管理 | src/routes/_app/permissions.tsx；src/lib/kb/query.ts | canReadDoc 在本地文档上执行角色权限判断 | 服务端身份、知识库 ACL、检索前过滤、审计 | 跨角色无数据泄露，撤权立即生效 | 待工程化 |
| 审计日志 | src/routes/_app/audit.tsx；admin.logs.tsx | 页面入口存在 | 真实审计事件及查询 | 操作可追溯，敏感信息不入日志 | 待工程化 |
| 内容审核 | src/routes/_app/admin.review.tsx | 已有后台页面；README 记录审核流程 | 状态机、审核权限、索引可见性控制 | 未通过审核内容不得入检索范围 | 待工程化 |
| 用户与角色 | src/routes/_app/admin.users.tsx、admin.roles.tsx | 已有页面入口；仓库依赖 better-auth | 核查现有 server 和认证代码，再决定补充 | 登录和越权场景测试 | 待详细审计 |
| 模型和系统设置 | src/routes/_app/admin.config.tsx、admin.keys.tsx | 管理页面存在 | 模型配置、密钥隔离、服务健康检查 | 密钥只在服务端；切换配置可验证 | 待工程化 |
| 运营总览 | src/routes/_app/admin.index.tsx | 管理页面存在 | 真实查询指标和统计 | 指标有来源及时间范围 | 待工程化 |

## 必须补做的原型核验

1. 解包 prototype/智能知识库V1.0.zip，逐屏登记页面、弹窗、字段、菜单、跳转、错误和空状态。
2. 建立稳定需求编号（例如 KB-ASK-001），标注原型画面或页面位置。
3. 每项功能明确“已有页面”“仅前端模拟”“已有后端”“已联通真实基础设施”“已验收”之一；不可把页面存在视为验收通过。
4. 在墨刀与代码存在差异时，记录差异并由产品负责人确认；不得由算法选型反向修改产品需求。
5. 产品验收与算法指标分开：前者检查功能和交互，后者通过统一题集检查召回、引用和响应成本。

## 产品与技术边界

- 产品原型约束交互和功能；具体引擎（Elasticsearch、OpenSearch、Qdrant）由技术验证决定。
- 保留现有 src、server、migrations，先做代码资产审计再重构。
- 未授权、未审核或已删除知识必须在检索阶段过滤，而不是生成后再遮挡。
- GitHub 禁止提交企业原始文档、完整 API Key、数据库密码、真实业务数据和解析结果。