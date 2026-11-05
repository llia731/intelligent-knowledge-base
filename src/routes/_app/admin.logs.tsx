import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { NeedPerm } from "@/components/app-shell";
import { useKb } from "@/lib/kb/store";

export const Route = createFileRoute("/_app/admin/logs")({
  component: () => <NeedPerm perm="系统日志"><LogsPage /></NeedPerm>,
});

const SAMPLE = [
  ["2026-09-15 10:23:18", "INFO", "auth", "用户 李建国 登录成功", "li.jianguo@company.com"],
  ["2026-09-15 10:21:05", "WARN", "api-gateway", "API 密钥 ak-7f3a... 触发速率限制", "10.0.4.21"],
  ["2026-09-15 10:18:42", "ERROR", "kb-index", "Confluence 同步失败：连接超时", "scheduler"],
  ["2026-09-15 10:15:30", "INFO", "review", "内容审核通过：id=rv-9821", "王雅婷"],
  ["2026-09-15 10:12:09", "DEBUG", "api-gateway", "/v1/search 响应耗时 124ms", "10.0.4.21"],
  ["2026-09-15 10:08:55", "INFO", "auth", "角色权限矩阵已更新", "李建国"],
  ["2026-09-15 09:56:22", "WARN", "kb-index", "文档重复率超过阈值：doc-7782", "scheduler"],
  ["2026-09-15 09:44:10", "INFO", "api-gateway", "新 API 密钥创建成功：ak-9d2c...", "赵晓东"],
];

function LogsPage() {
  const logs = useKb((s) => s.logs);
  const [level, setLevel] = useState("全部级别");
  const [moduleName, setModuleName] = useState("全部模块");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const rows = useMemo(() => {
    const live = logs.map((item) => [item.createdAt.replace("T", " ").slice(0, 19), "INFO", "app", `${item.action}：${item.target}`, item.actor]);
    return [...live, ...SAMPLE].filter((row) => {
      if (level !== "全部级别" && row[1] !== level) return false;
      if (moduleName !== "全部模块" && row[2] !== moduleName) return false;
      if (q && !row.join(" ").toLowerCase().includes(q.trim().toLowerCase())) return false;
      return true;
    });
  }, [logs, level, moduleName, q]);
  const pageSize = 8;
  const slice = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <h1 className="page-h">系统日志</h1>
      <p className="page-sub">查看系统运行日志、审计记录与安全事件</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input className="field max-w-xs" placeholder="搜索事件" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <select className="select" style={{ width: 140 }} value={level} aria-label="级别" onChange={(e) => { setLevel(e.target.value); setPage(1); }}>
          {["全部级别", "INFO", "WARN", "ERROR", "DEBUG"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <select className="select" style={{ width: 160 }} value={moduleName} aria-label="模块" onChange={(e) => { setModuleName(e.target.value); setPage(1); }}>
          {["全部模块", "app", "auth", "api-gateway", "kb-index", "review"].map((item) => <option key={item}>{item}</option>)}
        </select>
        <button type="button" className="btn ghost" onClick={() => {
          const blob = slice.map((row) => row.join("\t")).join("\n");
          void navigator.clipboard?.writeText(blob);
        }}>导出</button>
      </div>
      <section className="card mt-4 overflow-auto">
        <table className="table">
          <thead><tr><th>时间</th><th>级别</th><th>模块</th><th>事件</th><th>操作人 / 来源</th></tr></thead>
          <tbody>
            {slice.map((row, index) => (
              <tr key={row.join("-") + index}>
                <td>{row[0]}</td>
                <td><span className={row[1] === "ERROR" ? "tag red" : row[1] === "WARN" ? "tag orange" : "tag"}>{row[1]}</span></td>
                <td>{row[2]}</td>
                <td>{row[3]}</td>
                <td>{row[4]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pager px-3 pb-3">
          <span>共 {rows.length} 条，第 {page} 页</span>
          <span className="flex gap-2">
            <button type="button" className="btn ghost" disabled={page <= 1} onClick={() => setPage((n) => n - 1)}>上一页</button>
            <button type="button" className="btn ghost" disabled={page * pageSize >= rows.length} onClick={() => setPage((n) => n + 1)}>下一页</button>
          </span>
        </div>
      </section>
      <p className="note mt-2">INFO/app 行来自本地操作记录。带 auth、api-gateway 等模块的行是原型示例，不是采集到的服务器日志。</p>
    </div>
  );
}
