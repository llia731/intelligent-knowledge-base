import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { NeedPerm } from "@/components/app-shell";
import { useKb } from "@/lib/kb/store";
import type { ResourceLink } from "@/lib/kb/types";

export const Route = createFileRoute("/_app/admin/config")({
  component: () => <NeedPerm perm="知识库配置"><ConfigPage /></NeedPerm>,
});

const SOURCES = [
  { name: "产品帮助中心", type: "在线文档", status: "同步中", at: "2026-09-15 09:10" },
  { name: "官方网站 FAQ", type: "网页抓取", status: "同步中", at: "2026-09-15 08:45" },
  { name: "工单知识库", type: "数据库", status: "待配置", at: "—" },
  { name: "Confluence 空间", type: "第三方 Wiki", status: "失败", at: "2026-09-14 22:00" },
];

function ConfigPage() {
  const settings = useKb((s) => s.settings);
  const saveSettings = useKb((s) => s.saveSettings);
  const connections = useKb((s) => s.connections);
  const saveConnections = useKb((s) => s.saveConnections);
  const addCollection = useKb((s) => s.addCollection);
  const [chunkSize, setChunkSize] = useState(settings.chunkSize);
  const [overlap, setOverlap] = useState(settings.overlap);
  const [strict, setStrict] = useState(settings.strict);
  const [links, setLinks] = useState<ResourceLink[]>(connections);
  const [notice, setNotice] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sources, setSources] = useState(SOURCES);
  const [strategy, setStrategy] = useState("按段落切分（推荐）");

  return (
    <div>
      <h1 className="page-h">知识库配置</h1>
      <p className="page-sub">管理数据来源、索引策略与同步计划</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_340px]">
        <section className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">数据来源列表</h2>
            <button type="button" className="btn ghost" onClick={() => {
              if (!sourceName.trim()) return;
              setSources((list) => [{ name: sourceName.trim(), type: "本地知识库", status: "待配置", at: "—" }, ...list]);
              addCollection(sourceName.trim());
              setSourceName("");
              setNotice("已加入本地知识库名称。同步任务没有连接外部采集器。");
            }}>新增来源</button>
          </div>
          <input className="field mb-3" placeholder="来源名称" value={sourceName} onChange={(e) => setSourceName(e.target.value)} />
          <table className="table">
            <thead><tr><th>来源名称</th><th>类型</th><th>状态</th><th>上次同步</th><th>操作</th></tr></thead>
            <tbody>
              {sources.map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>{item.type}</td>
                  <td><span className={item.status === "失败" ? "tag red" : item.status === "待配置" ? "tag orange" : "tag blue"}>{item.status}</span></td>
                  <td>{item.at}</td>
                  <td className="space-x-2 text-sm">
                    <button type="button" className="text-[var(--m-blue)]" onClick={() => setNotice(`「${item.name}」没有可编辑的远端连接。`)}>编辑</button>
                    <button type="button" className="text-[var(--m-blue)]" onClick={() => setNotice(`「${item.name}」立即同步未执行：采集服务未接入。`)}>立即同步</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="note mt-2">来源表除了你新建的名称，都是原型示例。</p>
        </section>
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">索引设置</h2>
            <button type="button" className="btn" onClick={() => { saveSettings({ chunkSize, overlap, strict }); setNotice("分块参数已保存，并重新切分了已索引文档。"); }}>配置</button>
          </div>
          <label className="mt-2 block text-sm">分块策略
            <select className="select mt-1" value={strategy} onChange={(e) => setStrategy(e.target.value)}>
              <option>按段落切分（推荐）</option>
              <option>按固定长度</option>
            </select>
          </label>
          <label className="mt-3 block text-sm">最大块长度 {chunkSize}
            <input className="mt-1 w-full" type="range" min={160} max={520} step={20} value={chunkSize} onChange={(e) => setChunkSize(Number(e.target.value))} />
          </label>
          <label className="mt-3 block text-sm">重叠长度 {overlap}
            <input className="mt-1 w-full" type="range" min={0} max={120} step={10} value={overlap} onChange={(e) => setOverlap(Number(e.target.value))} />
          </label>
          <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} />严格引用（问答禁止脱离资料补全）</label>
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked />启用语义去重（未接入）</label>
          <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" defaultChecked />自动索引新文档</label>
        </section>
      </div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="card p-4">
          <h2 className="text-sm font-semibold">同步计划</h2>
          {[
            ["每日全量同步", "02:00 执行", "已启用"],
            ["实时增量同步", "Webhook 触发", "已启用"],
            ["每周深度重建索引", "周日 04:00", "已禁用"],
          ].map(([title, desc, state]) => (
            <div key={title} className="mt-3 flex items-center justify-between rounded-xl bg-[var(--m-paper)] px-3 py-2">
              <span><span className="block text-sm font-medium">{title}</span><span className="text-xs text-[var(--m-sub)]">{desc}</span></span>
              <span className={state === "已禁用" ? "tag" : "tag green"}>{state}</span>
            </div>
          ))}
          <p className="note mt-2">计划时间为原型示例，没有调度器在跑。</p>
        </section>
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Embedding 模型</h2>
            <button type="button" className="btn ghost" onClick={() => { saveConnections(links); setNotice("连接配置已记在本地，日志结果为「未发起连接」。问答模型不读这里，而读服务端模型目录。"); }}>配置</button>
          </div>
          {links.map((link) => (
            <label key={link.id} className="mt-2 block text-xs text-[var(--m-sub)]">{link.kind} · {link.label}
              <input className="field mt-1" value={link.endpoint} placeholder="端点（留空表示未连接）" onChange={(event) => setLinks((list) => list.map((item) => item.id === link.id ? { ...item, endpoint: event.target.value } : item))} />
            </label>
          ))}
          <ul className="mt-3 space-y-2 text-sm">
            <li>BGE-large-zh-v1.5 · 向量维度 1024</li>
            <li>text-embedding-3-small · 向量维度 1536</li>
            <li>M3E-base · 向量维度 768</li>
          </ul>
          <p className="note mt-2">切换模型后将触发全量重新索引，建议在低峰期操作。上述三个名称是原型文案，不是已接通的嵌入服务。</p>
        </section>
      </div>
      {notice ? <p className="note mt-3">{notice}</p> : null}
    </div>
  );
}
