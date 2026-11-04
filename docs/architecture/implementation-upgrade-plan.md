# 智能知识库 V1.0 技术升级实施方案

## 目标与约束

- **固定产品范围**：依据 prototype/智能知识库V1.0.zip 实现既定页面、业务和交互；算法引擎可升级，产品原型不随底层选型变化。
- **工程基线**：沿用已有 React、TanStack 前端和 server、migrations；先审计后重构，不创建重复的鉴权、业务数据管理功能。
- **技术学习**：以 RAGFlow 为全文与混合检索工程参考；以 LightRAG 为图增强与增量更新参考；参照 Dify 的可调试流水线设计。外部源码须锁定 Tag/Commit、记录真实路径及许可证。
- **实现策略**：先复现成熟可运行能力，保持原版基线，之后在交通行业语料上做单项优化、消融和回归验证。

## 当前核实的关键技术缺口

1. src/lib/kb/chunk.ts 的 chunkText 基于字符和重叠窗口，尚未完成章节、页码、表格和引用定位处理。
2. chunk.ts 的 scoreChunk 和 query.ts 的 rankHits 是本地词频匹配与排序，不是 BM25、Dense 检索或多路融合。
3. ask.functions.ts 仍用外部 x.ai 接口和客户端传入的 contexts；应改为经服务端鉴权、实际检索和证据过滤后生成答案。
4. README 明确将服务端持久化、实际 PDF/Office 解析和真实向量库连接列为后续工作。已有 migrations、认证及服务端相关代码须再审计，避免与 README 的简述混淆。

## 目标模块

| 模块 | 建议职责 | 实施要点 |
|---|---|---|
| Web 产品 | 已有 src 页面与交互 | 逐屏对照墨刀，不重画产品 |
| 业务服务 | 认证、权限、知识库、文件、审核、版本、任务、会话 | 优先复用现有 server 与 migrations |
| RAG 算法服务 | 解析协调、结构化、分块、嵌入、检索、融合、重排、引用 | 可单独测试；通过清晰契约接入业务层 |
| MinerU 适配器 | 调用远端 file_parse 和 tasks 系列接口 | 远端地址 http://172.16.14.246:40040；先用授权样例校验实际响应结构 |
| 模型适配器 | BGE-M3、BGE-Reranker-v2-M3、GLM-5.3 | 网关 http://172.16.12.3:4000/v1；密钥仅由服务端环境注入 |
| 搜索后端适配器 | BM25、Dense、过滤及批量索引 | 先通过实验比较 ES、OpenSearch、Qdrant，不预先锁死 |
| 评测系统 | 固定题集、索引版本、检索明细、效果及延迟 | 记录 Recall@k、nDCG、MRR、证据完整性、P95 |

## 推荐的稳定接口契约

业务服务对算法层主要调用：
- `POST /v1/ingestion/jobs`：提交入库任务；返回本地 job_id。
- `GET /v1/ingestion/jobs/{job_id}`：查询状态和失败原因。
- `POST /v1/retrieval/search`：接收已验证的身份作用域、过滤条件和查询；返回规范化 Evidence 结果。
- `POST /v1/qa/answer`：根据可读知识范围生成答案与引用（流式协议另行版本化）。
- `POST /v1/retrieval/debug`：供获授权的研发用户查看 BM25、Dense、融合和重排阶段的结果与延迟。

**安全注意**：客户端不得自行声明可访问的 collection_id 作为授权依据；权限必须由业务后端核验并下推。算法服务不直接暴露给未鉴权用户。

建议数据实体：Document、DocumentVersion、ParseJob、StructureBlock、Chunk、IndexRevision、RetrievalHit、Evidence、Conversation、AuditEvent。所有 Evidence 至少包含文档版本、片段 ID、章节及可获得的页码定位；没有原文定位依据时明确标记缺失。

## 研究复现与研发代码如何隔离

- 上游 RAGFlow 和 LightRAG 独立检出，锁定版本；不整体复制进产品仓库。
- 产品仓库增加 docs/upstream-research 保存源码路径、版本、流程及差异说明。
- 先让同一批文档、同一个 Embedding、同一查询集分别在上游基线和本系统运行。
- 每次算法改进只修改单项策略，保留开关和实验配置；未证明收益的改进不得作为默认策略。
- 评测数据、机密文件及服务端凭据不提交 GitHub。

## 152 服务器部署约束

- 本机已确认 DockerRootDir 为 /data/docker；另有 containerd 快照数据可能位于根分区，必须在镜像拉取前确认。
- 根分区接近满载；任何清理、镜像迁移和其他项目容器操作须经管理员授权。
- 业务容器使用独立 ikb 前缀、明确资源限制、独立网络与 /data/ikb 数据卷。
- MinerU 与模型推理复用既有内网 HTTP 服务；本轮尚未取得 MinerU 的真实响应验证证据。
- 对现有 Redis、MinIO、PG 和 LightRAG 只读核查，未经所属团队授权不读写业务数据。

## 代码改造顺序

1. 固化原型需求编号和前端路由映射；审计 server、migrations、auth、现有测试及环境变量。
2. 确定 Document、StructureBlock、Chunk、Evidence 的统一字段和接口契约。
3. 建立算法服务最小骨架与 mock 集成测试，不依赖远程模型即可运行 CI。
4. 接入 MinerU 同步和异步调用，保存解析结构及原文定位。
5. 复现成熟 BM25、Dense、RRF、Reranker 基线，检索后端经实验确定。
6. 联通上传、审核、索引、搜索、问答、引用的真实业务闭环。
7. 补齐权限变更、删除、版本更新、失败重试的索引一致性与审计。
8. 建立交通行业题集并验证优化收益，然后再考虑 LightRAG 图增强。

## 近期不执行

不重做墨刀前端；不在未经验证情况下整体 Fork RAGFlow 作为产品；不立即拉 Elasticsearch 或 Qdrant 镜像；不修改 main；不将本地简化评分标称为 BM25。