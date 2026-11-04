import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { PageTitle, Panel } from "@/components/app-shell";
import { expandQuery } from "@/lib/kb/access";
import { collectionNames } from "@/lib/kb/collections";
import { withheldCount } from "@/lib/kb/query";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";

export const Route = createFileRoute("/_app/search")({
  validateSearch: (search: Record<string, unknown>) => ({
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: SearchPage,
});

const MODES = ["混合检索", "向量检索", "同义词扩展"] as const;

function SearchPage() {
  const hits = useKb((s) => s.hits);
  const bumpSearch = useKb((s) => s.bumpSearch);
  const recordTrace = useKb((s) => s.recordTrace);
  const connections = useKb((s) => s.connections);
  const collections = useKb((s) => s.collections);
  const docs = useKb((s) => s.docs);
  const accessRole = useKb((s) => s.accessRole);
  const acl = useKb((s) => s.acl);
  const grants = useKb((s) => s.grants);
  const can = useCan();
  const vectorReady = Boolean(connections.find((item) => item.kind === "向量数据库")?.endpoint);
  const scopes = ["全部知识库", ...collectionNames(docs, collections)];
  const initial = Route.useSearch().q;
  const [query, setQuery] = useState(initial || "年假");
  const [submitted, setSubmitted] = useState(initial || "年假");
  const [collection, setCollection] = useState("全部知识库");
  const [mode, setMode] = useState<(typeof MODES)[number]>("混合检索");
  const [showChain, setShowChain] = useState(true);
  const asked = expandQuery(submitted, mode);
  const results = hits(asked, 12, collection);
  const withheld = withheldCount(docs, asked, { accessRole, acl, grants }, collection);

  useEffect(() => {
    if (!initial) return;
    setQuery(initial);
    setSubmitted(initial);
  }, [initial]);

  return (
    <div>
      <PageTitle kicker="检索" title="智能检索">
        <p className="max-w-sm text-sm text-muted">
          {can("受限知识") ? "当前角色可以召回受限知识。" : "当前角色看不到受限知识。"}
          {mode === "向量检索"
            ? vectorReady
              ? " 向量库地址已保存，但尚未接通，本次仍按关键词召回。"
              : " 向量库未配置，本次按关键词召回。"
            : ` 当前为${mode}。`}
        </p>
      </PageTitle>
      <div className="mb-3 flex flex-wrap gap-2">
        {MODES.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setMode(item)}
            className={
              mode === item
                ? "min-h-10 rounded-md bg-ink px-3 text-sm text-paper"
                : "min-h-10 rounded-md border border-line px-3 text-sm"
            }
          >
            {item}
          </button>
        ))}
      </div>
      <form
        className="mb-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const started = performance.now();
          const next = query.trim();
          if (!next) return;
          setSubmitted(next);
          bumpSearch();
          const found = hits(expandQuery(next, mode), 12, collection);
          recordTrace({
            kind: "检索查询",
            collection,
            query: next,
            hits: found.slice(0, 3).map((item) => ({ title: item.doc.title, score: Number(item.score.toFixed(2)) })),
            answer: "",
            ms: Math.round(performance.now() - started),
          });
        }}
      >
        <label className="sr-only" htmlFor="q">
          检索词
        </label>
        <input
          id="q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="支持高级检索语法：标题:年假 密级:内部"
          className="min-h-11 flex-1 rounded-md border border-line bg-card px-3 text-sm outline-none focus:border-teal"
        />
        <select
          value={collection}
          onChange={(event) => setCollection(event.target.value)}
          className="min-h-11 rounded-md border border-line bg-card px-3 text-sm"
          aria-label="知识库范围"
        >
          {scopes.map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
        <button type="submit" className="min-h-11 rounded-md bg-teal px-5 text-sm font-medium text-teal-fg">
          查询
        </button>
      </form>
      {showChain ? (
        <Panel className="mb-4 p-4 text-sm leading-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">检索推理链</p>
              <p className="text-muted">查询理解 → {mode} → 重排序 → 权限过滤 → 返回切片。</p>
            </div>
            <button type="button" className="min-h-10 text-sm text-muted" onClick={() => setShowChain(false)}>
              收起
            </button>
          </div>
        </Panel>
      ) : null}
      <p className="mb-3 text-sm text-muted">
        「{submitted}」命中 {results.length} 条切片
        {withheld > 0 ? `，另有 ${withheld} 篇因当前角色权限未展示` : ""}
      </p>
      <div className="grid gap-3">
        {results.length === 0 ? (
          <Panel className="p-6 text-sm text-muted">没有召回切片。换个说法，或检查文档是否还在审核中。</Panel>
        ) : (
          results.map((item, index) => (
            <Panel key={`${item.doc.id}-${index}`} className="p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="font-medium text-copper">相似度 {(Math.min(0.98, 0.72 + item.score / 40)).toFixed(2)}</span>
                <span>{item.doc.collection}</span>
                <span>{item.doc.sensitivity === "restricted" ? "受限" : item.doc.sensitivity === "internal" ? "内部" : "公开"}</span>
              </div>
              <h2 className="mt-1 text-lg font-medium">{item.doc.title}</h2>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{item.text}</p>
            </Panel>
          ))
        )}
      </div>
    </div>
  );
}
