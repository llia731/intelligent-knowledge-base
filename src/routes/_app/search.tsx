import { createFileRoute } from "@tanstack/react-router";
import * as Dialog from "@radix-ui/react-dialog";
import { useEffect, useMemo, useRef, useState } from "react";
import { expandQuery } from "@/lib/kb/access";
import { collectionNames } from "@/lib/kb/collections";
import { canReadDoc } from "@/lib/kb/query";
import {
  localCategories,
  searchLocalDocuments,
  unsupportedSyntax,
  type LocalSearchFilters,
} from "@/lib/kb/local-search";
import { useKb } from "@/lib/kb/store";
import type { KbDoc } from "@/lib/kb/types";
import "./search-visual.css";
export const Route = createFileRoute("/_app/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: SearchPage,
});
const MODES = ["语义检索", "关键词检索", "混合模式"] as const;
const SUGGEST = ["RAG 架构设计", "向量数据库选型", "prompt 工程技巧", "知识图谱构建"];
const SYNTAX = [
  "title:微调",
  "tag:RAG",
  "author:李明",
  "date:[2024-01-01 TO 2024-12-31]",
  "(LLM AND 安全) NOT 测试",
];
const SAMPLE_SCOPES = ["产品知识库", "技术文档库", "客户档案库", "法规标准库"];
const LEVELS: KbDoc["sensitivity"][] = ["public", "internal", "restricted"];
const LEVEL_LABEL = { public: "公开", internal: "内部", restricted: "机密" };
const emptyFilters = (): LocalSearchFilters => ({
  scopes: null,
  types: ["文档"],
  category: "",
  start: "",
  end: "",
  author: "",
  levels: [...LEVELS],
});
function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="search-icon"
      style={{
        width: size,
        height: size,
        maskImage: `url(/modao/search/${name}.svg)`,
        WebkitMaskImage: `url(/modao/search/${name}.svg)`,
      }}
    />
  );
}
const SAMPLE = [
  {
    title: "大模型微调（Fine-tuning）最佳实践指南",
    score: "0.94",
    excerpt:
      "...在准备大模型微调数据时，建议采用指令跟随与思维链相结合的方式，并对训练集进行多样性采样。 LoRA 与 QLoRA 可在保持基座能力的同时显著降低显存占用...",
    kb: "技术文档库",
    date: "2024-11-15",
    author: "张维",
    level: "公开",
    tags: ["LLM", "微调"],
  },
  {
    title: "RAG 系统中的向量检索与重排序策略",
    score: "0.91",
    excerpt:
      "...RAG 召回阶段通常采用密集检索 + 稀疏检索的混合方案，通过交叉编码器（Cross-Encoder）对 Top-K 结果进行重排序，可进一步提升答案相关度...",
    kb: "产品知识库",
    date: "2024-10-28",
    author: "王磊",
    level: "内部",
    tags: ["RAG", "向量"],
  },
  {
    title: "Prompt 工程：Few-shot 与 Chain-of-Thought 模板",
    score: "0.88",
    excerpt:
      "...有效的 Prompt 应包含角色定义、任务描述、输出格式与示例。 Few-shot 示例可增强模型对任务范式的理解，而 Chain-of-Thought 则能引导模型逐步推理，降低幻觉风险...",
    kb: "技术文档库",
    date: "2024-09-20",
    author: "陈晓",
    level: "公开",
    tags: ["Prompt", "LLM"],
  },
  {
    title: "企业知识库权限模型与密级管控方案",
    score: "0.85",
    excerpt:
      "...知识库权限应基于 RBAC 与 ABAC 结合的方式设计，按文档密级（公开 / 内部 / 机密）控制访问范围，并对敏感检索记录进行审计...",
    kb: "法规标准库",
    date: "2024-08-12",
    author: "刘芳",
    level: "机密",
    tags: ["权限", "安全"],
  },
];
function dateValue(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY;
}

function exampleHighlight(text: string, title: string) {
  const word = title.startsWith("大模型微调")
    ? "大模型微调"
    : title.startsWith("RAG")
      ? "RAG"
      : title.startsWith("企业知识库")
        ? "密级"
        : "";
  if (!word) return text;
  return text.split(word).flatMap((part, index) =>
    index
      ? [
          <span className="search-highlight" key={index}>
            {word}
          </span>,
          part,
        ]
      : [part],
  );
}

function SearchPage() {
  const docs = useKb((s) => s.docs),
    collections = useKb((s) => s.collections),
    accessRole = useKb((s) => s.accessRole),
    acl = useKb((s) => s.acl),
    grants = useKb((s) => s.grants);
  const bumpSearch = useKb((s) => s.bumpSearch),
    recordTrace = useKb((s) => s.recordTrace);
  const initial = Route.useSearch().q;
  const [query, setQuery] = useState(initial),
    [submitted, setSubmitted] = useState(initial),
    [executed, setExecuted] = useState(Boolean(initial));
  const [mode, setMode] = useState<(typeof MODES)[number]>("语义检索");
  const [filters, setFilters] = useState<LocalSearchFilters>(emptyFilters);
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1),
    [sort, setSort] = useState("按相关度排序");
  const [message, setMessage] = useState("");
  const [activeDoc, setActiveDoc] = useState<KbDoc | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const executedDomain = useRef(Boolean(initial));
  const access = useMemo(() => ({ accessRole, acl, grants }), [accessRole, acl, grants]);
  const availableDocs = useMemo(
    () => docs.filter((d) => d.status === "indexed" && canReadDoc(d, access)),
    [docs, access],
  );
  const localScopes = collectionNames(availableDocs, collections).filter(
    (name) => !acl[name]?.length || acl[name].includes(accessRole),
  );
  const scopeNames = executed ? localScopes : SAMPLE_SCOPES;
  const categoryNames = [...new Set(availableDocs.flatMap(localCategories))];
  useEffect(() => {
    const incomingDomain = Boolean(initial);
    if (executedDomain.current !== incomingDomain) {
      setFilters(emptyFilters());
      setTag("");
    }
    executedDomain.current = incomingDomain;
    setQuery(initial);
    setSubmitted(initial);
    setExecuted(Boolean(initial));
    setPage(1);
    setMessage("");
  }, [initial]);
  useEffect(() => {
    setPage(1);
  }, [filters, mode, sort, tag]);
  useEffect(() => {
    if (activeDoc && !canReadDoc(activeDoc, access)) setActiveDoc(null);
  }, [activeDoc, access]);
  const asked = expandQuery(submitted, mode === "混合模式" ? "同义词扩展" : mode);
  const syntaxError = executed && unsupportedSyntax(submitted);
  const dateError = Boolean(filters.start && filters.end && filters.start > filters.end);
  const localResults = useMemo(
    () => (executed ? searchLocalDocuments(docs, asked, access, filters) : []),
    [docs, asked, access, filters, executed],
  );
  const view = useMemo(() => {
    const list = [...localResults];
    if (sort === "按时间")
      list.sort(
        (a, b) =>
          dateValue(b.doc.updatedAt) - dateValue(a.doc.updatedAt) ||
          a.doc.id.localeCompare(b.doc.id),
      );
    return list;
  }, [localResults, sort]);
  const samples = useMemo(() => {
    let list = SAMPLE.filter(
      (s) =>
        (filters.scopes === null || filters.scopes.includes(s.kb)) &&
        filters.types.includes("文档") &&
        (!tag || s.tags.includes(tag)) &&
        (!filters.author || s.author.includes(filters.author)) &&
        filters.levels.includes(
          s.level === "公开" ? "public" : s.level === "内部" ? "internal" : "restricted",
        ) &&
        (!filters.start || s.date >= filters.start) &&
        (!filters.end || s.date <= filters.end),
    );
    if (sort === "按时间") list = [...list].sort((a, b) => b.date.localeCompare(a.date));
    return dateError ? [] : list;
  }, [filters, tag, sort, dateError]);
  const total = executed ? view.length : samples.length;
  const pageCount = Math.max(1, Math.ceil(total / 4)),
    safePage = Math.min(page, pageCount),
    pageStart = (safePage - 1) * 4;
  const shown = executed
    ? view.slice(pageStart, pageStart + 4).map((h) => ({
        key: h.doc.id,
        title: h.doc.title,
        text: h.text,
        kb: h.doc.collection,
        author: h.doc.owner,
        date: Number.isFinite(Date.parse(h.doc.updatedAt)) ? h.doc.updatedAt.slice(0, 10) : "",
        level: LEVEL_LABEL[h.doc.sensitivity],
        tags: [] as string[],
        score: "",
        doc: h.doc,
      }))
    : samples.slice(pageStart, pageStart + 4).map((s) => ({
        key: s.title,
        title: s.title,
        text: s.excerpt,
        kb: s.kb,
        author: s.author,
        date: s.date,
        level: s.level,
        tags: s.tags,
        score: s.score,
        doc: null,
      }));
  function patch(next: Partial<LocalSearchFilters>) {
    setFilters((f) => ({ ...f, ...next }));
    setPage(1);
  }
  function toggleScope(name: string) {
    const selected = filters.scopes === null ? [...scopeNames] : filters.scopes;
    patch({
      scopes: selected.includes(name) ? selected.filter((s) => s !== name) : [...selected, name],
    });
  }
  function toggleType(name: string) {
    patch({
      types: filters.types.includes(name)
        ? filters.types.filter((s) => s !== name)
        : [...filters.types, name],
    });
  }
  function reset() {
    setFilters(emptyFilters());
    setTag("");
    setPage(1);
  }
  function run(next = query) {
    const q = next.trim();
    const effective = executed ? filters : emptyFilters();
    if (!executed) {
      reset();
      setMessage("已进入本地演示检索；原型示例筛选已重置。");
    }
    setSubmitted(q);
    setExecuted(true);
    executedDomain.current = true;
    setPage(1);
    if (
      !q ||
      unsupportedSyntax(q) ||
      (effective.start && effective.end && effective.start > effective.end)
    )
      return;
    const start = performance.now();
    const found = searchLocalDocuments(
      docs,
      expandQuery(q, mode === "混合模式" ? "同义词扩展" : mode),
      access,
      effective,
    );
    const elapsed = Math.round((performance.now() - start) * 100) / 100;
    bumpSearch();
    recordTrace({
      kind: "检索查询",
      collection: effective.scopes === null ? "全部知识库" : effective.scopes.join("、"),
      query: q,
      hits: found.slice(0, 5).map((h) => ({ title: h.doc.title, score: h.keywordScore })),
      answer: "本地关键词词频匹配分，不是语义相关度；未调用向量或生成服务。",
      ms: elapsed,
    });
  }
  async function copy(text: string) {
    setMessage("");
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(text);
      setMessage(executed ? "已复制本地摘要。" : "已复制原型示例摘要。");
    } catch {
      setMessage("复制失败，请手动选择文本复制。");
    }
  }
  function openSource(doc: KbDoc) {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setActiveDoc(doc);
  }
  const boundary = !executed
    ? "原型示例，非真实检索结果；示例分数来自设计稿。语义/向量服务未接入。"
    : mode === "混合模式"
      ? "本地演示：仅固定同义词扩展后做关键词匹配；混合/向量服务未接入，相关度未计算。"
      : mode === "语义检索"
        ? "本地演示：语义/向量服务未接入，本次仍为关键词匹配；相关度未计算。"
        : "本地演示：仅关键词词频匹配，不调用远端向量/模型服务；相关度未计算。";
  return (
    <div className="search-page">
      <h1 className="page-h">智能检索</h1>
      <p className="page-sub">语义检索、关键词检索与多路召回融合</p>
      <section className="search-intro card">
        <div className="search-mode-row">
          <div className="search-modes">
            {MODES.map((m, i) => (
              <button
                type="button"
                key={m}
                aria-pressed={mode === m}
                className={mode === m ? "on" : ""}
                onClick={() => {
                  setMode(m);
                  setPage(1);
                }}
              >
                <Icon name={["semantic", "keyword", "hybrid"][i]} />
                {m}
              </button>
            ))}
          </div>
          <p className="search-boundary">{boundary}</p>
        </div>
        <form
          className="search-query"
          onSubmit={(e) => {
            e.preventDefault();
            run();
          }}
        >
          <Icon name="search" size={20} />
          <input
            aria-label="检索关键词"
            value={query}
            placeholder="输入自然语言问题或检索关键词，例如：大模型微调最佳实践"
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="submit">检索</button>
        </form>
        <div className="search-suggestions">
          <span>搜索建议：</span>
          {SUGGEST.map((s) => (
            <button
              type="button"
              key={s}
              onClick={() => {
                setQuery(s);
                run(s);
              }}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="search-syntax" aria-label="高级检索语法">
          <h2>
            <Icon name="syntax" />
            高级检索语法
          </h2>
          <div className="search-syntax-tags">
            {SYNTAX.map((s) => (
              <button
                type="button"
                key={s}
                title="仅填入设计稿示例；本地不支持该语法解析"
                onClick={() => setQuery(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </section>
      <div className="search-layout">
        <aside className="search-filters card" aria-label="筛选条件">
          <header>
            <h2>筛选条件</h2>
            <button type="button" onClick={reset}>
              重置
            </button>
          </header>
          <section className="search-filter-group">
            <h3>知识库来源</h3>
            <div className="search-checks">
              {scopeNames.map((name) => (
                <label key={name}>
                  <input
                    type="checkbox"
                    aria-label={name}
                    checked={filters.scopes === null || filters.scopes.includes(name)}
                    onChange={() => toggleScope(name)}
                  />
                  <span>{name}</span>
                </label>
              ))}
              {!scopeNames.length ? <small>暂无可用知识库</small> : null}
            </div>
          </section>
          <section className="search-filter-group">
            <h3>文档类型</h3>
            <div className="search-checks">
              {["文档", "问答", "表格", "图标"].map((t) => (
                <label
                  key={t}
                  title={
                    t === "问答"
                      ? "未接入问答实体检索"
                      : "本地按已保存文件名扩展名识别，不解析原文件"
                  }
                >
                  <input
                    type="checkbox"
                    aria-label={t}
                    disabled={t === "问答"}
                    checked={filters.types.includes(t)}
                    onChange={() => toggleType(t)}
                  />
                  <span>{t}</span>
                </label>
              ))}
            </div>
          </section>
          <section className="search-filter-group search-tag-group">
            <h3>标签</h3>
            <div className="search-tags">
              {["LLM", "RAG", "向量", "Agent", "微调"].map((t) => (
                <button
                  type="button"
                  key={t}
                  disabled={executed}
                  aria-pressed={tag === t}
                  className={tag === t ? "on" : ""}
                  title={
                    executed ? "本地文档未记录独立标签；不能伪造标签筛选" : "仅筛选原型示例的标签"
                  }
                  onClick={() => {
                    setTag(tag === t ? "" : t);
                    setPage(1);
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
            {executed ? <small className="search-tag-note">本地未记录独立标签</small> : null}
          </section>
          <section className="search-filter-group search-category-group">
            <h3>分类</h3>
            <select
              aria-label="分类"
              value={filters.category}
              disabled={!executed || !categoryNames.length}
              title="只匹配本地已保存分类路径中的分段；未接入企业分类服务"
              onChange={(e) => patch({ category: e.target.value })}
            >
              <option value="">全部分类</option>
              {categoryNames.map((name) => (
                <option key={name}>{name}</option>
              ))}
            </select>
          </section>
          <section className="search-filter-group search-time-group">
            <h3>时间范围</h3>
            <input
              type="date"
              aria-label="起始日期"
              value={filters.start}
              onChange={(e) => patch({ start: e.target.value })}
            />
            <input
              type="date"
              aria-label="截止日期"
              value={filters.end}
              onChange={(e) => patch({ end: e.target.value })}
            />
          </section>
          <section className="search-filter-group search-author-group">
            <h3>作者</h3>
            <div className="search-author">
              <Icon name="author" />
              <input
                aria-label="作者"
                placeholder="输入作者姓名"
                value={filters.author}
                onChange={(e) => patch({ author: e.target.value })}
              />
            </div>
          </section>
          <section className="search-filter-group search-sensitivity-group">
            <h3>密级</h3>
            <div className="search-checks search-levels">
              {LEVELS.map((l) => (
                <label key={l}>
                  <input
                    type="checkbox"
                    aria-label={LEVEL_LABEL[l]}
                    checked={filters.levels.includes(l)}
                    onChange={() =>
                      patch({
                        levels: filters.levels.includes(l)
                          ? filters.levels.filter((v) => v !== l)
                          : [...filters.levels, l],
                      })
                    }
                  />
                  <span>{LEVEL_LABEL[l]}</span>
                </label>
              ))}
            </div>
          </section>
        </aside>
        <section className="search-results" aria-label="检索结果">
          <div className="search-results-head">
            <p>
              共找到 <b>{total}</b> 条{executed ? "本地结果" : "原型示例"}
            </p>
            <div>
              <select
                aria-label="排序"
                value={sort}
                title="本地匹配排序不是语义相关度；按时间使用实际更新时间降序"
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
              >
                <option value="按相关度排序">按本地匹配排序</option>
                <option value="按时间">按时间</option>
              </select>
              <button type="button" disabled title="未接入导出服务，不生成文件">
                <Icon name="export" />
                导出
              </button>
              <button type="button" disabled title="未记录可下载原始文件，未接入批量下载服务">
                <Icon name="download" />
                批量下载
              </button>
            </div>
          </div>
          {syntaxError ? (
            <p className="search-alert" role="alert">
              本地不支持高级语法解析，请使用普通关键词或左侧字段筛选。该语法示例尚未执行检索。
            </p>
          ) : null}
          {dateError ? (
            <p className="search-alert" role="alert">
              起始日期不能晚于截止日期。
            </p>
          ) : null}
          {executed && !submitted.trim() ? (
            <p className="search-alert" role="alert">
              请输入普通关键词；尚未执行检索。
            </p>
          ) : null}
          <div className="search-result-list">
            {shown.map((s) => (
              <article key={s.key} className="search-result card" data-example={!executed}>
                <div className="search-result-main">
                  <h3>
                    <button
                      type="button"
                      disabled={!s.doc}
                      title={s.doc ? "查看本地已保存文本" : "原型示例没有真实原文件"}
                      onClick={() => {
                        if (s.doc) openSource(s.doc);
                      }}
                    >
                      {s.title}
                    </button>
                  </h3>
                  <p className="search-excerpt">
                    {executed ? s.text || "未保存正文内容。" : exampleHighlight(s.text, s.title)}
                  </p>
                  <div className="search-result-meta">
                    <span>
                      <Icon name="knowledge" size={14} />
                      {s.kb}
                    </span>
                    <span>
                      <Icon name="calendar" size={14} />
                      {s.date || "时间未记录"}
                    </span>
                    <span>
                      <Icon name="author" size={14} />
                      {s.author}
                    </span>
                    <span>{s.level}</span>
                    {s.tags.map((t) => (
                      <span className="search-tag" key={t}>
                        {t}
                      </span>
                    ))}
                    {!executed ? <span className="search-example">原型示例</span> : null}
                    <div className="search-local-actions">
                      <button
                        type="button"
                        aria-label="查看本地来源"
                        disabled={!s.doc}
                        title="仅展示本地已保存文本，不伪造原文件地址或 PDF 阅读能力"
                        onClick={() => {
                          if (s.doc) openSource(s.doc);
                        }}
                      >
                        查看来源
                      </button>
                      <button type="button" aria-label="复制摘要" onClick={() => void copy(s.text)}>
                        复制摘要
                      </button>
                    </div>
                  </div>
                </div>
                <div className="search-result-actions">
                  <span
                    className="search-relevance"
                    aria-label={executed ? "相关度未计算" : `原型示例相关度 ${s.score}`}
                    title={
                      executed
                        ? "未接入真实相关度服务；不把词频打分伪装成概率"
                        : "设计稿示例分数，非真实检索结果"
                    }
                  >
                    <Icon name="relevance" size={14} />
                    {executed ? "—" : s.score}
                  </span>
                  <div>
                    <button
                      type="button"
                      aria-label="有帮助"
                      disabled
                      title="反馈服务未接入，未提交反馈"
                    >
                      <Icon name="like" />
                    </button>
                    <button
                      type="button"
                      aria-label="无帮助"
                      disabled
                      title="反馈服务未接入，未提交反馈"
                    >
                      <Icon name="dislike" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {executed && !total && !syntaxError && !dateError && submitted.trim() ? (
            <p className="search-empty card">没有命中已授权的已索引文档。</p>
          ) : null}
          <nav className="pager search-pager" aria-label="检索分页">
            <span>
              {total
                ? `显示 ${pageStart + 1}–${Math.min(pageStart + 4, total)} 条，共 ${total} 条`
                : "共 0 条"}
            </span>
            <div>
              <button type="button" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>
                上一页
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === pageCount || Math.abs(n - safePage) <= 1)
                .map((n, i, all) => (
                  <span key={n}>
                    {i > 0 && n - all[i - 1] > 1 ? (
                      <span className="search-page-gap">…</span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`第 ${n} 页`}
                      aria-current={safePage === n ? "page" : undefined}
                      onClick={() => setPage(n)}
                    >
                      {n}
                    </button>
                  </span>
                ))}
              <button
                type="button"
                disabled={safePage === pageCount}
                onClick={() => setPage(safePage + 1)}
              >
                下一页
              </button>
            </div>
          </nav>
          <p className="search-capabilities">
            本地演示：权限仅按本地数据过滤；文件类型按扩展名、分类按已有路径、时间按已存 UTC
            日期筛选。标签缺失、问答检索、反馈、导出和批量下载未接入；复制只复制当前摘要，来源只显示已保存文本。
          </p>
        </section>
      </div>
      {message ? (
        <div className="search-toast" role="status">
          {message}
          <button type="button" aria-label="关闭提示" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      ) : null}
      <Dialog.Root
        open={Boolean(activeDoc)}
        onOpenChange={(open) => {
          if (!open) setActiveDoc(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="search-source-backdrop" />
          <Dialog.Content
            className="search-source-dialog"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              opener.current?.focus();
            }}
          >
            <Dialog.Title>{activeDoc?.title}</Dialog.Title>
            <Dialog.Description>
              本地已保存文本；不是原文件/PDF 阅读器，也未调用生成服务。
            </Dialog.Description>
            <pre>{activeDoc?.content}</pre>
            <Dialog.Close>关闭</Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
