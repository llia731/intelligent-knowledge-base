import { createFileRoute, Link } from "@tanstack/react-router";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageTitle, Panel, NeedPerm } from "@/components/app-shell";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";

export const Route = createFileRoute("/_app/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const docs = useKb((s) => s.docs);
  const asks = useKb((s) => s.asks);
  const searches = useKb((s) => s.searches);
  const reviews = useKb((s) => s.reviews);
  const logs = useKb((s) => s.logs);
  const traces = useKb((s) => s.traces);
  const can = useCan();
  if (!can("总览仪表盘")) return <NeedPerm perm="总览仪表盘">{null}</NeedPerm>;

  const open = reviews.filter((item) => item.status === "open").length;
  const liveDocs = docs.filter((doc) => doc.status !== "trashed");
  const avgMs = traces.length
    ? Math.round(traces.reduce((sum, item) => sum + item.ms, 0) / traces.length)
    : null;
  const byCollection = Object.values(
    liveDocs.reduce<Record<string, { name: string; count: number }>>((acc, doc) => {
      const row = acc[doc.collection] ?? { name: doc.collection, count: 0 };
      row.count += 1;
      acc[doc.collection] = row;
      return acc;
    }, {}),
  );

  const cards = [
    ["知识库数量", String(new Set(liveDocs.map((doc) => doc.collection)).size)],
    ["检索次数", String(searches)],
    ["问答次数", String(asks)],
    ["平均响应", avgMs === null ? "尚无记录" : `${avgMs} ms`],
    ["待审核", String(open)],
  ];

  return (
    <div>
      <PageTitle kicker="后台" title="总览仪表盘" />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(([label, value]) => (
          <Panel key={label} className="p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 font-display text-4xl tabular-nums">{value}</p>
          </Panel>
        ))}
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Panel className="p-4">
          <h2 className="text-sm font-medium">各知识库文档数</h2>
          <div className="mt-3 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCollection}>
                <XAxis dataKey="name" interval={0} angle={-18} height={56} tick={{ fontSize: 11 }} stroke="var(--color-muted)" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="var(--color-muted)" />
                <Tooltip />
                <Bar dataKey="count" fill="var(--color-teal)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel className="p-4">
          <h2 className="text-sm font-medium">待处理</h2>
          <p className="mt-2 font-display text-4xl tabular-nums text-copper">{open}</p>
          <p className="mt-1 text-sm text-muted">条审核或反馈尚未关闭</p>
          <Link to="/admin/review" className="mt-4 inline-flex min-h-11 items-center text-sm font-medium text-teal">
            去审核
          </Link>
          <h2 className="mt-6 text-sm font-medium">最近操作</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {logs.slice(0, 4).map((entry) => (
              <li key={entry.id}>
                <span className="text-muted">{entry.actor}</span> {entry.action} · {entry.target}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
