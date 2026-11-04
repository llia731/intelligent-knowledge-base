import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { PageTitle, Panel } from "@/components/app-shell";
import { collectionNames } from "@/lib/kb/collections";
import { useKb } from "@/lib/kb/store";

export const Route = createFileRoute("/_app/")({
  component: HomePage,
});

function HomePage() {
  const navigate = useNavigate();
  const docs = useKb((s) => s.docs);
  const collections = useKb((s) => s.collections);
  const assistants = useKb((s) => s.assistants);
  const addAssistant = useKb((s) => s.addAssistant);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("制度问答助手");
  const [scope, setScope] = useState("全部知识库");
  const [style, setStyle] = useState("严谨引用");
  const live = docs.filter((doc) => doc.status !== "trashed");
  const names = collectionNames(live, collections, { seed: false });

  return (
    <div>
      <PageTitle kicker="用户端" title="首页">
        <p className="max-w-md text-sm text-muted">基于已索引的知识库检索和问答。新建的助手会限制问答范围。</p>
      </PageTitle>
      <form
        className="mb-4 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          void navigate({ to: "/search", search: { q: query.trim() || "年假" } });
        }}
      >
        <label className="sr-only" htmlFor="global-q">
          全局搜索
        </label>
        <input
          id="global-q"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="全局搜索知识、文档、问答"
          className="min-h-11 flex-1 rounded-md border border-line bg-card px-3 text-sm"
        />
        <button type="submit" className="min-h-11 rounded-md bg-teal px-5 text-sm font-medium text-teal-fg">
          检索
        </button>
        <button type="button" onClick={() => setOpen(true)} className="min-h-11 rounded-md border border-line px-4 text-sm">
          创建 AI 助手
        </button>
      </form>
      <div className="mb-4 flex flex-wrap gap-2">
        {["年假多少天", "怎么报销", "试用期转正"].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => void navigate({ to: "/search", search: { q: item } })}
            className="min-h-10 rounded-md border border-line bg-card px-3 text-sm"
          >
            {item}
          </button>
        ))}
      </div>
      {assistants.length > 0 ? (
        <p className="mb-4 text-sm text-ok">已有助手：{assistants.map((item) => item.name).join("、")}。在 AI 问答左上角选用。</p>
      ) : null}
      <h2 className="mb-3 text-sm font-medium">知识库</h2>
      <div className="grid gap-3 lg:grid-cols-3">
        {names.map((collection) => {
          const rows = live.filter((doc) => doc.collection === collection);
          const indexed = rows.filter((doc) => doc.status === "indexed").length;
          return (
            <Panel key={collection} className="p-4">
              <h3 className="font-display text-2xl">{collection}</h3>
              <p className="mt-2 text-sm text-muted">
                {rows.length} 篇 · 已索引 {indexed}
                {rows.length - indexed > 0 ? ` · ${rows.length - indexed} 篇未进检索` : ""}
              </p>
              <Link to="/search" search={{ q: collection }} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-teal">
                检索这个库
              </Link>
            </Panel>
          );
        })}
      </div>
      <h2 className="mb-3 mt-6 text-sm font-medium">文档</h2>
      <div className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">文档</th>
              <th className="px-4 py-3 font-medium">知识库</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">切片</th>
            </tr>
          </thead>
          <tbody>
            {live.slice(0, 8).map((doc) => (
              <tr key={doc.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-medium">{doc.title}</td>
                <td className="px-4 py-3">{doc.collection}</td>
                <td className="px-4 py-3">{doc.status === "indexed" ? "已索引" : doc.status === "pending" ? "待审核" : "已驳回"}</td>
                <td className="px-4 py-3 tabular-nums">{doc.chunks.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-line px-4 py-3 text-xs text-muted">共 {live.length} 篇，不含回收站</p>
      </div>
      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button type="button" aria-label="关闭" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(false)} />
          <Panel className="relative z-10 m-4 w-full max-w-lg p-5">
            <h2 className="font-display text-2xl">创建 AI 助手</h2>
            <label className="mt-3 block text-sm">
              助手名称
              <input value={name} onChange={(event) => setName(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-line px-3" />
            </label>
            <label className="mt-3 block text-sm">
              知识库范围
              <select value={scope} onChange={(event) => setScope(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-line px-3">
                <option>全部知识库</option>
                {names.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="mt-3 block text-sm">
              回答风格
              <select value={style} onChange={(event) => setStyle(event.target.value)} className="mt-1 min-h-11 w-full rounded-md border border-line px-3">
                <option>严谨引用</option>
                <option>客服话术</option>
                <option>简短结论</option>
              </select>
            </label>
            <p className="mt-3 text-sm text-muted">助手只影响检索范围和回答风格，不会另接外部模型。</p>
            <button
              type="button"
              className="mt-4 min-h-11 rounded-md bg-teal px-4 text-sm text-teal-fg"
              onClick={() => {
                addAssistant({ name, collection: scope, style });
                setOpen(false);
              }}
            >
              保存
            </button>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
