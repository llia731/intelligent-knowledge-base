import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { expandQuery } from "@/lib/kb/access";
import { collectionNames } from "@/lib/kb/collections";
import { withheldCount } from "@/lib/kb/query";
import { useKb } from "@/lib/kb/store";

export const Route = createFileRoute("/_app/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: SearchPage,
});

const MODES = ["语义检索", "关键词检索", "混合模式"] as const;
const SUGGEST = ["RAG 架构设计", "向量数据库选型", "prompt 工程技巧", "知识图谱构建"];
const SYNTAX = ["title:微调", "tag:RAG", "author:李明", "date:[2024-01-01 TO 2024-12-31]", "(LLM AND 安全) NOT 测试"];

const SAMPLE = [
  {
    title: "大模型微调（Fine-tuning）最佳实践指南",
    score: "0.94",
    excerpt: "在准备数据时，建议采用指令跟随与思维链相结合的方式，并对训练集进行多样性采样。LoRA 与 QLoRA 可在保持基座能力的同时显著降低显存占用。",
    kb: "技术文档库",
    date: "2024-11-15",
    author: "张维",
    level: "公开",
    tags: ["LLM", "微调"],
  },
  {
    title: "RAG 系统中的向量检索与重排序策略",
    score: "0.91",
    excerpt: "召回阶段通常采用密集检索 + 稀疏检索的混合方案，通过交叉编码器（Cross-Encoder）对 Top-K 结果进行重排序，可进一步提升答案相关度。",
    kb: "产品知识库",
    date: "2024-10-28",
    author: "王磊",
    level: "内部",
    tags: ["RAG", "向量"],
  },
  {
    title: "Prompt 工程：Few-shot 与 Chain-of-Thought 模板",
    score: "0.88",
    excerpt: "有效的 Prompt 应包含角色定义、任务描述、输出格式与示例。Few-shot 示例可增强模型对任务范式的理解，而 Chain-of-Thought 则能引导模型逐步推理。",
    kb: "技术文档库",
    date: "2024-09-20",
    author: "陈晓",
    level: "公开",
    tags: ["Prompt", "LLM"],
  },
  {
    title: "企业知识库权限模型与密级管控方案",
    score: "0.85",
    excerpt: "知识库权限应基于 RBAC 与 ABAC 结合的方式设计，按文档密级（公开 / 内部 / 机密）控制访问范围，并对敏感检索记录进行审计。",
    kb: "法规标准库",
    date: "2024-08-12",
    author: "刘芳",
    level: "机密",
    tags: ["权限", "安全"],
  },
];

function SearchPage() {
  const hits = useKb((s) => s.hits);
  const bumpSearch = useKb((s) => s.bumpSearch);
  const recordTrace = useKb((s) => s.recordTrace);
  const docs = useKb((s) => s.docs);
  const collections = useKb((s) => s.collections);
  const accessRole = useKb((s) => s.accessRole);
  const acl = useKb((s) => s.acl);
  const grants = useKb((s) => s.grants);
  const initial = Route.useSearch().q;
  const [query, setQuery] = useState(initial);
  const [submitted, setSubmitted] = useState(initial);
  const [mode, setMode] = useState<(typeof MODES)[number]>("语义检索");
  const [collection, setCollection] = useState("全部知识库");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("按相关度排序");
  const [exportNote, setExportNote] = useState("");
  const scopes = ["全部知识库", ...collectionNames(docs, collections)];

  useEffect(() => {
    setQuery(initial);
    setSubmitted(initial);
  }, [initial]);

  const live = submitted.trim().length > 0;
  const asked = expandQuery(submitted, mode === "混合模式" ? "同义词扩展" : mode);
  const results = live ? hits(asked, 12, collection) : [];
  const withheld = live ? withheldCount(docs, asked, { accessRole, acl, grants }, collection) : 0;
  const view = useMemo(() => {
    const list = [...results];
    if (sort === "按时间") list.reverse();
    return list;
  }, [results, sort]);

  function run(next = query) {
    const q = next.trim();
    setSubmitted(q);
    setPage(1);
    if (!q) return;
    bumpSearch();
    const found = hits(expandQuery(q, mode === "混合模式" ? "同义词扩展" : mode), 12, collection);
    recordTrace({
      kind: "检索查询",
      collection,
      query: q,
      hits: found.slice(0, 5).map((item) => ({ title: item.doc.title, score: item.score })),
      answer: "",
      ms: 34,
    });
  }

  const total = live ? view.length : SAMPLE.length;

  return (
    <div>
      <h1 className="page-h">智能检索</h1>
      <p className="page-sub">语义检索、关键词检索与多路召回融合</p>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div className="seg">
          {MODES.map((item) => (
            <button key={item} type="button" className={mode === item ? "on" : ""} onClick={() => setMode(item)}>{item}</button>
          ))}
        </div>
      </div>
      <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); run(); }}>
        <input className="field" value={query} placeholder="搜索知识、文档、问答…" onChange={(e) => setQuery(e.target.value)} aria-label="检索关键词" />
        <button className="btn" type="submit">检索</button>
      </form>
      <p className="mt-3 text-sm text-[var(--m-sub)]">
        搜索建议：
        {SUGGEST.map((item) => (
          <button key={item} type="button" className="ml-3 text-[var(--m-ink)]" onClick={() => { setQuery(item); run(item); }}>{item}</button>
        ))}
      </p>

      <div className="mt-4 grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="card h-fit p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">筛选条件</h2>
            <button type="button" className="text-xs text-[var(--m-blue)]" onClick={() => setCollection("全部知识库")}>重置</button>
          </div>
          <p className="text-xs font-medium text-[var(--m-sub)]">知识库来源</p>
          <div className="mt-2 space-y-1">
            {scopes.slice(0, 8).map((item) => (
              <label key={item} className="flex items-center gap-2 text-sm">
                <input type="radio" name="kb" checked={collection === item} onChange={() => setCollection(item)} />
                {item}
              </label>
            ))}
          </div>
          <p className="mt-4 text-xs font-medium text-[var(--m-sub)]">高级检索语法</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {SYNTAX.map((item) => (
              <button key={item} type="button" className="chip" onClick={() => setQuery(item)}>{item}</button>
            ))}
          </div>
          <p className="note mt-3">排序目前按本地关键词打分。语义向量与混合召回服务未接入；「混合模式」仅追加同义词。</p>
        </aside>

        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <p>共找到 <b>{live ? total : 128}</b> 条结果{live ? "" : "（耗时 0.34s）"}{withheld > 0 ? `，另有 ${withheld} 篇因权限未展示` : ""}</p>
            <div className="flex items-center gap-2">
              <select className="select" style={{ width: 140 }} value={sort} onChange={(e) => setSort(e.target.value)} aria-label="排序">
                <option>按相关度排序</option>
                <option>按时间</option>
              </select>
              <button type="button" className="btn ghost" onClick={() => setExportNote("已复制当前结果标题到提示。没有文件导出服务。")}>导出</button>
            </div>
          </div>
          {exportNote ? <p className="note mb-2">{exportNote}</p> : null}
          <div className="space-y-3">
            {live
              ? view.map((hit) => {
                  const level = ({ public: "公开", internal: "内部", restricted: "受限" } as const)[hit.doc.sensitivity];
                  const score = Math.min(0.98, 0.72 + hit.score / 40).toFixed(2);
                  return (
                    <article key={`${hit.doc.id}-${hit.score}-${hit.text.slice(0, 12)}`} className="card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-base font-semibold">{hit.doc.title}</h3>
                        <span className="text-xs font-semibold text-[var(--m-blue)]">{score}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-[var(--m-sub)]">{hit.text}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--m-sub)]">
                        <span className="tag">{hit.doc.collection}</span>
                        <span>{hit.doc.owner}</span>
                        <span className={level === "受限" ? "tag red" : "tag"}>{level}</span>
                      </div>
                    </article>
                  );
                })
              : SAMPLE.map((item) => (
                  <article key={item.title} className="card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-base font-semibold">{item.title}</h3>
                      <span className="text-xs font-semibold text-[var(--m-blue)]">{item.score}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-[var(--m-sub)]">{item.excerpt}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--m-sub)]">
                      <span className="tag">{item.kb}</span>
                      <span>{item.date}</span>
                      <span>{item.author}</span>
                      <span className={item.level === "机密" ? "tag red" : "tag"}>{item.level}</span>
                      {item.tags.map((tag) => <span key={tag} className="tag blue">{tag}</span>)}
                      <span className="note">原型示例结果</span>
                    </div>
                  </article>
                ))}
            {live && view.length === 0 ? <p className="card p-6 text-sm">没有命中已授权的已索引文档。</p> : null}
          </div>
          <div className="pager">
            <span>{live ? `显示 ${view.length} 条` : "显示 1-4 条，共 128 条"}</span>
            <span className="flex gap-2">
              <button type="button" className="btn ghost" disabled={page <= 1} onClick={() => setPage((n) => Math.max(1, n - 1))}>上一页</button>
              <button type="button" className="btn ghost" onClick={() => setPage((n) => n + 1)}>下一页</button>
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
