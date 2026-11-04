# RAG 核心接口和数据模型草案 v0.1

> 此文档是研发契约草案，不是已经实现或经产品方确认的 API。产品界面和业务流程以墨刀 V1.0 为准。设计不依赖具体搜索引擎、解析框架和语言实现。

## 一、基本数据对象

| 对象 | 必需字段 | 特别说明 |
|---|---|---|
| Document | id、kb_id、title、owner_id、sensitivity、status、created_at | 管理实体，不与索引分片混为一谈 |
| DocumentVersion | id、document_id、version_no、sha256、storage_key、parse_status、index_status | 绑定原始文件与解析结果；版本变化不覆盖历史 |
| ParseJob | id、document_version_id、remote_task_id、state、attempt、last_error、created_at | MinerU 返回的 task_id 需要另存，不能直接作为本地业务任务 ID |
| StructureBlock | id、document_version_id、block_type、content、heading_path、page_start、page_end、source_locator | 版面结构和页码如无法从接口获得，应允许 null 而不是编造 |
| Chunk | id、document_version_id、block_ids、text、parent_chunk_id、ordinal、chunk_strategy、chunk_version | 片段可回溯至来源结构块，便于实验与索引重建 |
| IndexRevision | id、kb_id、search_backend、embedding_model、embedding_dim、chunk_version、created_at、state | 防止不同模型维度和分块策略污染同一个索引 |
| RetrievalHit | chunk_id、document_id、document_version_id、stage、rank、score、source_locator | BM25 分数、向量相似度和重排分数不可混用 |
| Evidence | evidence_id、chunk_id、document_version_id、quote、source_locator、authorized_scope_id | 由服务端构建，必须能指向实际已授权的来源 |
| IngestionEvent | job_id、state、occurred_at、details | 支撑上传进度和失败原因显示 |

## 二、文档状态建议

文档业务审核状态与技术索引状态**分别管理**：

- 审核：`pending_review`、`approved`、`rejected`。
- 解析：`queued`、`submitted`、`running`、`completed`、`failed`。
- 索引：`not_indexed`、`indexing`、`ready`、`failed`、`stale`。
- 业务生命周期：`active`、`trashed`。

**可检索的必要条件**：当前文档版本被审核允许、业务生命周期正常、索引版本已激活、调用者具有相应访问权限。技术状态完成不能跳过人工审核。具体审核先后顺序尚待墨刀逐屏核对。

## 三、接口草案

### POST /v1/ingestion/jobs

入参（示例）：
```json
{"document_id":"doc_001","document_version_id":"ver_002","source_type":"uploaded_file"}
```
输出：`{"job_id":"job_001","state":"queued"}`。上传文件保存和业务鉴权由上游业务服务负责，内部 API 之间使用独立服务身份。

### GET /v1/ingestion/jobs/{job_id}

输出：`job_id`、`state`、`stage`、`error_code`、`updated_at`；进度百分比仅在真实可测时返回，不模拟固定定时进度。

### POST /v1/retrieval/search

内部请求包括 `query`、`authorized_scope`、`filters`、`top_k`、`strategy`；`authorized_scope` 必须由可信业务后端构建，不接受浏览器自行声明权限。

输出包含 `hits`、`index_revision`、`strategy`、`latency_ms`，每条命中包含文档版本和真实来源字段。

### POST /v1/qa/answer

业务侧传入已验证的用户请求上下文、查询及会话 ID；算法服务自行获取已授权证据并返回 `answer`、`evidences`、`citation_map`、`model`。**不得把任意浏览器 contexts 当成可信证据**。

### POST /v1/retrieval/debug

仅研发授权角色可调用。每阶段分别保留 `bm25_hits`、`dense_hits`、`fused_hits`、`reranked_hits`、`latency_ms`、`configuration_hash`，用于复现与错误定位。

## 四、MinerU 协议与边界

现有已提供远程服务基础地址 `http://172.16.14.246:40040`：
- 同步：`POST /file_parse`，multipart `files` 和解析参数。
- 异步：`POST /tasks`，`GET /tasks/{task_id}`，完成后 `GET /tasks/{task_id}/result`。
- 参数建议从显式配置读取，如 `backend=hybrid-auto-engine`、`lang_list=["ch"]`、`formula_enable=true`、`table_enable=true`。
- **本轮未实际调用上述 API；其响应结构、重试机制、分页和页面定位字段均待验证**。客户端提交失败不应盲目重复提交任务。

## 五、搜索后端策略

统一实现 `index_chunks`、`delete_document_version`、`lexical_search`、`vector_search`、`health`。

- BM25 和 Dense 分别返回候选与对应排名，RRF 独立进行排名融合；引擎已有混合查询时允许在后端实现优化。
- 优先以相同语料、相同分块、相同 BGE-M3 embedding 测试 Elasticsearch、OpenSearch 或 Qdrant；先记录检索效果，再决定后端。
- Reranker 使用内网服务；长片段截断与分片必须记录策略，不能悄悄丢失证据。
- 搜索过滤应按权限与文档版本下推；对于搜索引擎不支持的过滤表达，应拒绝或采取明确的安全回退，不能默默省略。

## 六、部署与安全

- 根分区接近满载，需确认 containerd 快照实际位置后再拉取镜像。
- 仅保留必要非敏感配置样例；用户密码、MinerU 任务包含的企业文档、模型 API Key、数据库凭据不得提交 GitHub。
- 服务端接口先实现 mock 合约及安全负例测试，随后在授权环境联通实测。
- 用户端页面保持墨刀需求；技术后端演进不要求用户重新学习产品交互。

## 七、待产品方确认

1. 墨刀对文档上传、审核、索引的实际顺序和失败状态交互。
2. 正式身份来源（院内单点登录、独立账号或已有统一身份平台）以及知识库授权粒度。
3. 原始文档及解析结果的存储、保存期限、下载和可见性要求。
4. 检索调试功能是内部研发接口，还是 V1.0 需要展示的正式页面。
