import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { PageTitle, Panel, NeedPerm } from "@/components/app-shell";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";
import { formatTime } from "@/lib/utils";

export const Route = createFileRoute("/_app/audit")({
  component: AuditPage,
});

const TYPES = ["全部操作", "检索查询", "AI 问答", "知识上传", "删除"];

function AuditPage() {
  const traces = useKb((s) => s.traces);
  const reviews = useKb((s) => s.reviews);
  const docs = useKb((s) => s.docs);
  const can = useCan();
  const [type, setType] = useState(TYPES[0]);
  const [open, setOpen] = useState<string | null>(null);
  const rows = useMemo(
    () => traces.filter((row) => type === "全部操作" || row.kind === type),
    [traces, type],
  );
  const current = rows.find((row) => row.id === open) ?? traces.find((row) => row.id === open) ?? null;
  const zero = traces.filter((row) => row.hits.length === 0);
  const stale = docs.filter((doc) => {
    const age = Date.now() - new Date(doc.updatedAt).getTime();
    return doc.status === "indexed" && age > 180 * 86400000;
  });
  const bad = reviews.filter((item) => item.reason.includes("不满意"));
  if (!can("审计日志")) return <NeedPerm perm="审计日志">{null}</NeedPerm>;
  const timed = traces.filter((row) => row.ms > 0);
  const avg = timed.length ? Math.round(timed.reduce((sum, row) => sum + row.ms, 0) / timed.length) : null;

  return (
    <div>
      <PageTitle kicker="链路" title="审计日志">
        <p className="text-sm text-muted">这里只记录你在这次使用中实际发生的检索、问答和上传。</p>
      </PageTitle>
      <Panel className="mb-4 flex flex-col gap-2 p-4 sm:flex-row">
        <select aria-label="操作类型" value={type} onChange={(event) => setType(event.target.value)} className="min-h-11 rounded-md border border-line bg-card px-3 text-sm">
          {TYPES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </Panel>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["平均耗时", avg === null ? "—" : `${avg} ms`],
          ["有结果的检索", String(traces.filter((row) => row.kind === "检索查询" && row.hits.length > 0).length)],
          ["零结果", String(zero.length)],
          ["不满意反馈", String(bad.length)],
        ].map(([label, value]) => (
          <Panel key={label} className="p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 font-display text-3xl tabular-nums">{value}</p>
          </Panel>
        ))}
      </div>
      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">时间</th>
              <th className="px-4 py-3 font-medium">用户</th>
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">问题 / 对象</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 tabular-nums">{formatTime(row.at)}</td>
                <td className="px-4 py-3">{row.actor}</td>
                <td className="px-4 py-3">{row.kind}</td>
                <td className="px-4 py-3">
                  <button type="button" className="min-h-10 text-left" onClick={() => setOpen(row.id)}>
                    {row.query}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 ? <p className="p-4 text-sm text-muted">还没有这类操作。去检索或提问后会记在这里。</p> : null}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel className="p-4">
          <h2 className="text-sm font-medium">需要处理的反馈</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {bad.length === 0 ? <li className="text-muted">还没有人标记不满意。</li> : null}
            {bad.map((item) => (
              <li key={item.id}>
                {item.title}
                <span className="ml-2 text-xs text-copper">{item.status === "open" ? "待审核" : item.status === "passed" ? "已通过" : "已驳回"}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="p-4">
          <h2 className="text-sm font-medium">知识缺口</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {zero.length === 0 ? <li className="text-muted">还没有零结果检索。</li> : null}
            {zero.slice(0, 5).map((row) => (
              <li key={row.id}>「{row.query}」没有召回切片。</li>
            ))}
            {stale.length > 0 ? <li>{stale.length} 篇文档超过 180 天未更新。</li> : null}
          </ul>
        </Panel>
      </div>
      {current ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button type="button" aria-label="关闭" className="absolute inset-0 bg-ink/40" onClick={() => setOpen(null)} />
          <Panel className="relative z-10 m-4 w-full max-w-lg p-5">
            <p className="text-xs tracking-widest text-copper">{current.kind}</p>
            <h2 className="mt-1 font-display text-2xl">{current.query}</h2>
            <p className="mt-3 text-sm leading-6">
              召回：{current.hits.length ? current.hits.map((hit) => `${hit.title}（${hit.score}）`).join("、") : "无"}
            </p>
            {current.answer ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">{current.answer}</p> : null}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
