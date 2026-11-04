# RAGFlow 源码研究：V1.0 产品技术参考

- 上游仓库：https://github.com/infiniflow/ragflow
- 固定 Tag：`v1.0.0-rc3`
- 固定 Commit：`03c1246150febe6b204b3799dffb3afe52103fb8`
- 核对时间：2026-11-04
- 研究目的：**学习并复现技术能力，不复制其 UI 或重新定义墨刀 V1.0 的产品范围。**

## 已通过上游源码确认的设计

| 关键模块 | 上游源码路径 | 观察到的实现 | 我们可复现的设计 |
|---|---|---|---|
| 搜索引擎统一接口 | [internal/engine/engine.go](https://github.com/infiniflow/ragflow/blob/v1.0.0-rc3/internal/engine/engine.go) | `Engine` 提供 `CreateChunkStore`、`InsertChunks`、`UpdateChunks`、`DeleteChunks`、`Search`、`GetChunk`、`DropChunkStore` 等操作 | 将索引与搜索封装在 SearchBackend 中，业务层不依赖 Elasticsearch 或 Qdrant |
| 统一搜索请求 | [internal/engine/types/types.go](https://github.com/infiniflow/ragflow/blob/v1.0.0-rc3/internal/engine/types/types.go) | `SearchRequest`、`SearchResult` 及 Dense、过滤和融合表达配置位于类型层 | 统一 BM25、Dense、过滤条件和分页结果契约 |
| Elasticsearch 索引写入 | [internal/engine/elasticsearch/chunk.go](https://github.com/infiniflow/ragflow/blob/v1.0.0-rc3/internal/engine/elasticsearch/chunk.go) | 区分普通写入时等待 refresh 与批量 ingest 时不等待 refresh；批量写入关注 chunk 数量和请求体积，避免 HTTP 413 | 引入 batch 限制、幂等写入、索引完成检查和错误恢复 |
| 元数据过滤 | [internal/engine/elasticsearch/meta_filter.go](https://github.com/infiniflow/ragflow/blob/v1.0.0-rc3/internal/engine/elasticsearch/meta_filter.go) | `MetaFilterTranslator` 将条件下推到 ES DSL；对无法翻译的过滤条件显式报错 | 设计统一过滤 DSL，确保知识库授权和文档版本条件在检索前生效 |
| 索引操作测试 | [internal/engine/elasticsearch/chunk_readback_test.go](https://github.com/infiniflow/ragflow/blob/v1.0.0-rc3/internal/engine/elasticsearch/chunk_readback_test.go)；[metadata_pushdown_test.go](https://github.com/infiniflow/ragflow/blob/v1.0.0-rc3/internal/engine/elasticsearch/metadata_pushdown_test.go) | 上游针对索引读取和元数据下推有明确测试文件 | 先实现索引一致性和权限过滤测试，再扩展算法优化 |

### 关于 BM25 的证据边界

- 上游当前 Tag 的 `internal/engine/elasticsearch` 目录已确认是 Elasticsearch 文档检索后端，且 `Engine.Search` 的统一能力存在。
- 本轮**尚未逐行追踪查询 DSL 的 BM25、Dense、融合评分的最终调用链**，不能断言 RAGFlow 的所有排序均为 RRF。
- 尚不能从当前源码证据认定官方 RAGFlow 直接使用 Qdrant BM25；需要在对应 Tag 的实际引擎代码中继续追踪检索评分策略。
- 不应仅凭“RAGFlow 支持混合检索”推导我们的 RRF、BM25 参数已经过上游同样配置验证。

## 建议复现顺序

1. SearchBackend 基础接口与统一 Document、Chunk、Evidence 类型。
2. 在固定语料上复现 BM25 全文检索与向量检索两个独立基线。
3. 复现索引批量写入、检索前授权过滤、按文档版本删除或更新。
4. 对照实验接入 RRF，再接入 BGE-Reranker；区分原版排序与自研融合，不混称。
5. 将每个版本的检索输入、候选数量、分数、延迟和 Evidence 来源写入评测报告。
6. 根据墨刀产品需求接入检索、问答、上传和知识管理页面。

## 后续待查

- `internal/ingestion` 中的异步处理、缓存、解析与分块管道的实际调度。
- `internal/deepdoc` 与 `internal/parser` 结构化解析所保留的信息。
- Elasticsearch `Search()` 内全文、向量与融合 DSL 的精确处理。
- 源码在实际部署时使用的发行版与技术许可证边界。
- 基于上游固定 Tag 的最小可运行复现结果；**仅静态核查还不算复现完成**。
