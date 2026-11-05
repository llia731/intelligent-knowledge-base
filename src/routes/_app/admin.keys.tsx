import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { NeedPerm } from "@/components/app-shell";
import { useKb } from "@/lib/kb/store";

export const Route = createFileRoute("/_app/admin/keys")({
  component: () => <NeedPerm perm="API密钥"><KeysPage /></NeedPerm>,
});

const SAMPLE = [
  { name: "官网搜索组件", secret: "ak-7f3a...2b9e", scope: "搜索 / 问答", usage: "68,420 / 100,000", state: "启用", at: "2026-08-12" },
  { name: "企业微信机器人", secret: "ak-9d2c...8f1a", scope: "仅问答", usage: "12,340 / 50,000", state: "启用", at: "2026-08-20" },
  { name: "内部测试环境", secret: "ak-1a8b...4c7d", scope: "全部接口", usage: "91,200 / 100,000", state: "将超限", at: "2026-09-01" },
  { name: "已废弃的旧官网", secret: "ak-4e5f...6a0b", scope: "搜索", usage: "0 / 10,000", state: "已撤销", at: "2026-06-15" },
];

function KeysPage() {
  const keys = useKb((s) => s.keys);
  const freshSecret = useKb((s) => s.freshSecret);
  const createKey = useKb((s) => s.createKey);
  const revokeKey = useKb((s) => s.revokeKey);
  const dismissSecret = useKb((s) => s.dismissSecret);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["读取"]);
  const [seen, setSeen] = useState<string | null>(null);

  function toggleScope(scope: string) {
    setScopes((list) => list.includes(scope) ? list.filter((item) => item !== scope) : [...list, scope]);
  }

  return (
    <div>
      <h1 className="page-h">API 密钥</h1>
      <p className="page-sub">管理第三方接入密钥、权限范围与使用统计</p>
      <section className="card mt-4 p-4">
        <div className="mb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold">API 密钥列表</h2>
          <button type="button" className="btn" onClick={() => setOpen(true)}>创建密钥</button>
        </div>
        <p className="note mb-3">密钥泄露后请立即撤销并重新生成。本地密钥以 zsk_live_ 开头，只在创建时完整显示一次。</p>
        {freshSecret ? (
          <div className="mb-3 rounded-xl bg-[#eef4ff] p-3 text-sm">
            <p>新密钥只显示这一次：</p>
            <p className="mt-1 font-mono">{freshSecret}</p>
            <button type="button" className="btn mt-2" onClick={() => dismissSecret()}>我已保存</button>
          </div>
        ) : null}
        <div className="overflow-auto">
          <table className="table">
            <thead><tr><th>密钥名称</th><th>密钥</th><th>权限范围</th><th>调用量（本月）</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id}>
                  <td><span className="block font-medium">{key.name}</span><span className="text-xs text-[var(--m-sub)]">创建于 {key.createdAt}</span></td>
                  <td className="font-mono text-xs">{key.secretPreview}</td>
                  <td>{key.scopes.join(" / ") || "读取"}</td>
                  <td>{key.calls} 次（本地计数，不是网关配额）</td>
                  <td><span className="tag green">启用</span></td>
                  <td className="space-x-2 text-sm">
                    <button type="button" className="text-[var(--m-blue)]" onClick={() => setSeen(key.secretPreview)}>查看</button>
                    <button type="button" className="text-[var(--m-blue)]" onClick={() => revokeKey(key.id)}>撤销</button>
                  </td>
                </tr>
              ))}
              {SAMPLE.map((item) => (
                <tr key={item.secret}>
                  <td><span className="block font-medium">{item.name}</span><span className="text-xs text-[var(--m-sub)]">创建于 {item.at}</span></td>
                  <td className="font-mono text-xs">{item.secret}</td>
                  <td>{item.scope}</td>
                  <td>{item.usage}</td>
                  <td><span className={item.state === "已撤销" ? "tag" : item.state === "将超限" ? "tag orange" : "tag green"}>{item.state}</span></td>
                  <td className="text-xs text-[var(--m-faint)]">原型示例</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="card p-4">
          <h2 className="text-sm font-semibold">接口调用分布</h2>
          {[["POST /v1/search", "58%"], ["POST /v1/chat", "31%"], ["GET /v1/documents", "8%"], ["其他", "3%"]].map(([name, pct]) => (
            <div key={name} className="mt-3">
              <div className="mb-1 flex justify-between text-xs"><span>{name}</span><span>{pct}</span></div>
              <div className="h-2 rounded-full bg-[#eef1f5]"><div className="h-full rounded-full bg-[var(--m-blue)]" style={{ width: pct }} /></div>
            </div>
          ))}
          <p className="note mt-2">分布是原型示意，没有统计真实调用。</p>
        </section>
        <section className="card p-4">
          <h2 className="text-sm font-semibold">配额提醒</h2>
          <article className="mt-3 rounded-xl bg-[var(--m-paper)] p-3">
            <p className="text-sm font-medium">内部测试环境密钥即将超限</p>
            <p className="text-xs text-[var(--m-sub)]">本月已使用 91.2%，建议提升配额或分流流量</p>
          </article>
          <article className="mt-2 rounded-xl bg-[var(--m-paper)] p-3">
            <p className="text-sm font-medium">安全告警：异常调用模式</p>
            <p className="text-xs text-[var(--m-sub)]">ak-7f3a...2b9e 在过去 1 小时内触发 403 异常 23 次</p>
          </article>
          <p className="note mt-2">告警文案来自原型，不是实时风控。</p>
        </section>
      </div>
      {open ? (
        <div className="overlay" onClick={() => setOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={(event) => {
            event.preventDefault();
            createKey(name, scopes.length ? scopes : ["读取"]);
            setName("");
            setOpen(false);
          }}>
            <h2 className="text-lg font-semibold">创建密钥</h2>
            <label className="mt-3 block text-sm">名称<input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <div className="mt-3 flex gap-3 text-sm">
              {["读取", "写入"].map((scope) => (
                <label key={scope}><input type="checkbox" checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} /> {scope}</label>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <button className="btn" type="submit">创建</button>
              <button className="btn ghost" type="button" onClick={() => setOpen(false)}>取消</button>
            </div>
          </form>
        </div>
      ) : null}
      {seen ? (
        <div className="overlay" onClick={() => setSeen(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold">密钥预览</h2>
            <p className="mt-2 font-mono text-sm">{seen}</p>
            <p className="note mt-2">完整密钥只在创建当下出现，这里只能看到预览。</p>
            <button type="button" className="btn mt-4" onClick={() => setSeen(null)}>关闭</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
