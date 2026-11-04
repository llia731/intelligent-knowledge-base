# LightRAG 源码研究：分块策略、图增强检索预研

- 上游仓库：https://github.com/HKUDS/LightRAG
- 固定 Tag：`v1.5.7`
- 固定 Commit：`28ff1b05f2ac3f3e6fa14dd2cd33656579bd0c9c`
- 核对时间：2026-11-04

## 已通过源码确认的机制

| 源码路径 | 关键发现 | 对本项目的价值 |
|---|---|---|
| [lightrag/chunker/__init__.py](https://github.com/HKUDS/LightRAG/blob/v1.5.7/lightrag/chunker/__init__.py) | 同时维护 legacy `chunking_by_token_size` 契约和文件分块策略分发契约；支持 F 固定 token、R 递归字符、V 向量语义、P 段落语义以及 C 自定义策略 | 以可扩展接口管理分块，不将固定字符窗口写死；保留兼容性 |
| [lightrag/chunker/token_size.py](https://github.com/HKUDS/LightRAG/blob/v1.5.7/lightrag/chunker/token_size.py) | 处理 token 窗口、重叠、分隔符，并包含来源文本跨度处理 | 设计 Chunk 时记录原文来源、位置和 tokenizer 配置 |
| [lightrag/chunker/paragraph_semantic.py](https://github.com/HKUDS/LightRAG/blob/v1.5.7/lightrag/chunker/paragraph_semantic.py) | 存在面向段落语义的分块实现 | 后续在规范章节、条款文本上开展对照实验 |
| [lightrag/rerank.py](https://github.com/HKUDS/LightRAG/blob/v1.5.7/lightrag/rerank.py) | 对超出 token 限制的待重排文档做分块，同时保留原文档索引映射；包含参数保护避免过小窗口导致爆炸式请求 | 为远程 BGE Reranker 设计输入预算、原片段映射和重排长文档策略 |

## 与 152 机器已有 LightRAG 的关系

152 审计报告发现团队已有独立 LightRAG 及 PostgreSQL/pgvector 实例。它可以作为学习技术栈和比较架构的参考；**不等于该服务的源码与官方 v1.5.7 完全一致，更不代表已经得到调用其业务接口或数据库的授权**。

## 推荐安排

- V1.0 首先复现基本 BM25、Dense、融合、重排及证据引用；GraphRAG 后移，不影响原型交付。
- 固定 LightRAG 上游源码版本，单独开展分块及长文本 Reranker 对照实验。
- 在算法优化前使用同一套 MinerU 输出、Embedding 模型和评测题集，控制变量。
- 不直接复制第三方完整服务代码到本项目；若复用具体实现，应检查版权许可、保留声明并增加回归测试。

## 尚未完成

本轮只完成了相关核心文件的静态源码研究，还没有运行 LightRAG 实例，也没有逐步验收 GraphRAG、增量更新或不同分块策略的实际性能。