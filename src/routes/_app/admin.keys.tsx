import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageTitle, Panel, NeedPerm } from "@/components/app-shell";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";

export const Route = createFileRoute("/_app/admin/keys")({
  component: KeysPage,
});

function KeysPage() {
  const keys = useKb((s) => s.keys);
  const freshSecret = useKb((s) => s.freshSecret);
  const createKey = useKb((s) => s.createKey);
  const revokeKey = useKb((s) => s.revokeKey);
  const dismissSecret = useKb((s) => s.dismissSecret);
  const can = useCan();
  const [name, setName] = useState("");
  const [read, setRead] = useState(true);
  const [write, setWrite] = useState(false);
  const busiest = [...keys].sort((a, b) => b.calls - a.calls)[0];
  const quota = busiest ? Math.min(100, Math.round((busiest.calls / 14000) * 1000) / 10) : 0;
  if (!can("API密钥")) return <NeedPerm perm="API密钥">{null}</NeedPerm>;

  return (
    <div>
      <PageTitle kicker="接入" title="API密钥">
        <p className="max-w-md text-sm text-muted">新建、撤销都会记入系统日志。完整密钥只在创建时显示一次。</p>
      </PageTitle>
      <div className="mb-4 grid gap-3 lg:grid-cols-2">
        <Panel className="p-4">
          <h2 className="text-sm font-medium">配额</h2>
          <p className="mt-2 text-sm leading-6">
            {busiest
              ? `调用最多的是「${busiest.name}」，按 14000 次月配额计算已使用 ${quota}%。`
              : "还没有密钥。"}
          </p>
        </Panel>
        <Panel className="p-4">
          <h2 className="text-sm font-medium">调用分布</h2>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            {keys.map((key) => (
              <li key={key.id}>
                {key.name} · {key.calls} 次 · {key.secretPreview}
              </li>
            ))}
          </ul>
        </Panel>
      </div>
      {freshSecret ? (
        <Panel className="mb-4 border-copper p-4">
          <p className="text-sm font-medium">请立即保存密钥</p>
          <p className="mt-1 text-sm text-muted">出于安全原因，关闭后无法再次查看完整私钥。</p>
          <p className="mt-3 break-all rounded-md bg-paper px-3 py-2 font-mono text-sm">{freshSecret}</p>
          <button type="button" onClick={() => dismissSecret()} className="mt-3 min-h-11 rounded-md bg-ink px-4 text-sm text-paper">
            我已保存
          </button>
        </Panel>
      ) : null}
      <Panel className="mb-4 p-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const scopes = [read ? "读取" : "", write ? "写入" : ""].filter(Boolean);
            createKey(name, scopes.length ? scopes : ["读取"]);
            setName("");
          }}
        >
          <label className="flex-1 text-sm">
            密钥名称
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例如：官网搜索组件"
              className="mt-1 min-h-11 w-full rounded-md border border-line px-3 text-sm"
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={read} onChange={(event) => setRead(event.target.checked)} />
            读取
          </label>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={write} onChange={(event) => setWrite(event.target.checked)} />
            写入
          </label>
          <button type="submit" className="min-h-11 rounded-md bg-teal px-4 text-sm text-teal-fg">
            创建密钥
          </button>
        </form>
      </Panel>
      <div className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">名称</th>
              <th className="px-4 py-3 font-medium">权限</th>
              <th className="px-4 py-3 font-medium">本月调用</th>
              <th className="px-4 py-3 font-medium">预览</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {keys.map((key) => (
              <tr key={key.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{key.name}</p>
                  <p className="text-xs text-muted">{key.createdAt}</p>
                </td>
                <td className="px-4 py-3">{key.scopes.join("、")}</td>
                <td className="px-4 py-3 tabular-nums">{key.calls}</td>
                <td className="px-4 py-3 font-mono text-xs">{key.secretPreview}</td>
                <td className="px-4 py-3">
                  <button type="button" className="min-h-10 text-copper" onClick={() => revokeKey(key.id)}>
                    撤销
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
