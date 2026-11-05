import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { NeedPerm } from "@/components/app-shell";
import { useKb } from "@/lib/kb/store";
import type { Trace } from "@/lib/kb/types";

export const Route = createFileRoute("/_app/audit")({ component: Page });

const TYPES = ["全部操作", "检索查询", "AI 问答", "知识上传", "删除"] as const;

function Page() {
  return <NeedPerm perm="审计日志"><AuditBody /></NeedPerm>;
}

function AuditBody() {
  const traces = useKb((s) => s.traces);
  const logs = useKb((s) => s.logs);
  const reviews = useKb((s) => s.reviews);
  const docs = useKb((s) => s.docs);
  const [kind, setKind] = useState<(typeof TYPES)[number]>("全部操作");
  const [actor, setActor] = useState("");
  const [active, setActive] = useState<Trace | null>(null);
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => traces.filter((item) => {
    if (kind !== "全部操作" && item.kind !== kind) return false;
    if (actor && !`${item.actor} ${item.query}`.includes(actor.trim())) return false;
    return true;
  }), [traces, kind, actor]);
  const pageSize = 8;
  const slice = filtered.slice((page - 1) * pageSize, page * pageSize);
  const unhappy = reviews.filter((item) => item.reason.includes("不满意"));
  const zero = traces.filter((item) => item.kind === "检索查询" && item.hits.length === 0);
  const stale = docs.filter((doc) => doc.status === "indexed" && Date.now() - new Date(doc.updatedAt).getTime() > 180 * 86400000);

  return (
    <div>
      <h1 className="page-h">审计日志</h1>
      <p className="page-sub">全链路操作记录与知识库运营分析</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <select className="select" style={{ width: 160 }} value={kind} onChange={(e) => { setKind(e.target.value as typeof kind); setPage(1); }} aria-label="操作类型">
          {TYPES.map((item) => <option key={item}>{item}</option>)}
        </select>
        <input className="field max-w-xs" placeholder="用户 / 关键词" value={actor} onChange={(e) => setActor(e.target.value)} aria-label="用户" />
        <button type="button" className="btn" onClick={() => setPage(1)}>查询</button>
        <button type="button" className="btn ghost" onClick={() => { setKind("全部操作"); setActor(""); }}>重置</button>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        <section className="card overflow-auto p-2">
          <table className="table">
            <thead><tr><th>时间</th><th>操作类型</th><th>用户</th><th>知识库</th><th>摘要</th><th></th></tr></thead>
            <tbody>
              {slice.map((item) => (
                <tr key={item.id}>
                  <td>{item.at.replace("T", " ").slice(0, 19)}</td>
                  <td>{item.kind}</td>
                  <td>{item.actor}</td>
                  <td>{item.collection}</td>
                  <td className="max-w-[240px] truncate">{item.query || item.answer}</td>
                  <td><button type="button" className="text-sm text-[var(--m-blue)]" onClick={() => setActive(item)}>详情</button></td>
                </tr>
              ))}
              {slice.length === 0 ? (
                <tr><td colSpan={6} className="text-sm text-[var(--m-sub)]">还没有操作轨迹。去检索、问答或上传后会出现在这里。下方系统日志仍保留示例记录。</td></tr>
              ) : null}
            </tbody>
          </table>
          <div className="pager">
            <span>共 {filtered.length} 条</span>
            <span className="flex gap-2">
              <button type="button" className="btn ghost" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>上一页</button>
              <button type="button" className="btn ghost" disabled={page * pageSize >= filtered.length} onClick={() => setPage((n) => n + 1)}>下一页</button>
            </span>
          </div>
          <h3 className="px-3 pt-2 text-sm font-semibold">系统记录</h3>
          <table className="table">
            <thead><tr><th>操作人</th><th>动作</th><th>对象</th><th>结果</th></tr></thead>
            <tbody>
              {logs.slice(0, 8).map((item) => (
                <tr key={item.id}><td>{item.actor}</td><td>{item.action}</td><td>{item.target}</td><td>{item.result}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
        <aside className="space-y-3">
          <section className="card p-4">
            <h2 className="text-sm font-semibold">不满意反馈</h2>
            {unhappy.length === 0 ? <p className="note mt-2">暂无</p> : unhappy.map((item) => <p key={item.id} className="mt-2 text-sm">{item.title}</p>)}
          </section>
          <section className="card p-4">
            <h2 className="text-sm font-semibold">零命中检索</h2>
            <p className="mt-2 text-2xl font-semibold">{zero.length}</p>
          </section>
          <section className="card p-4">
            <h2 className="text-sm font-semibold">超过 180 天未更新</h2>
            <p className="mt-2 text-2xl font-semibold">{stale.length}</p>
          </section>
        </aside>
      </div>
      {active ? (
        <div className="overlay" onClick={() => setActive(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">{active.kind}</h2>
            <p className="page-sub">{active.actor} · {active.collection} · {active.ms} ms</p>
            <p className="mt-3 text-sm">查询：{active.query || "—"}</p>
            <p className="mt-2 whitespace-pre-wrap text-sm">{active.answer || "无回答"}</p>
            <ul className="mt-2 text-sm text-[var(--m-sub)]">{active.hits.map((hit) => <li key={hit.title}>{hit.title} · {hit.score}</li>)}</ul>
            <button type="button" className="btn mt-4" onClick={() => setActive(null)}>关闭</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
