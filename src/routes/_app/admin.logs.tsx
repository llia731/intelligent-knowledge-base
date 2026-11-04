import { createFileRoute } from "@tanstack/react-router";
import { PageTitle, NeedPerm } from "@/components/app-shell";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";
import { formatTime } from "@/lib/utils";

export const Route = createFileRoute("/_app/admin/logs")({
  component: LogsPage,
});

function LogsPage() {
  const logs = useKb((s) => s.logs);
  const can = useCan();
  if (!can("系统日志")) return <NeedPerm perm="系统日志">{null}</NeedPerm>;

  return (
    <div>
      <PageTitle kicker="审计" title="系统日志" />
      <div className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">时间</th>
              <th className="px-4 py-3 font-medium">操作人</th>
              <th className="px-4 py-3 font-medium">类型</th>
              <th className="px-4 py-3 font-medium">对象</th>
              <th className="px-4 py-3 font-medium">结果</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((entry) => (
              <tr key={entry.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 tabular-nums">{formatTime(entry.createdAt)}</td>
                <td className="px-4 py-3">{entry.actor}</td>
                <td className="px-4 py-3">{entry.action}</td>
                <td className="px-4 py-3">{entry.target}</td>
                <td className="px-4 py-3">{entry.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
