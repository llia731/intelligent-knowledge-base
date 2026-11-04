import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  BookOpen, Bot, ChartNoAxesCombined, ClipboardList, Eye,
  FileText, FolderKanban, MessageSquare, Search, ShieldCheck, UploadCloud, UserRound,
} from "lucide-react";
import { useKb } from "@/lib/kb/store";
import { collectionNames } from "@/lib/kb/collections";

export const Route = createFileRoute("/_app/")({ component: HomePage });

/**
 * Layout adapted from the *rendered* Modao V1.0 homepage reference.
 * Counters and activities currently come from the demo Zustand store:
 * they are NOT operational or production analytics.
 */
function HomePage() {
  const navigate = useNavigate();
  const docs = useKb((s) => s.docs);
  const collections = useKb((s) => s.collections);
  const logs = useKb((s) => s.logs);
  const searches = useKb((s) => s.searches);
  const asks = useKb((s) => s.asks);
  const addAssistant = useKb((s) => s.addAssistant);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [name, setName] = useState("制度问答助手");
  const [scope, setScope] = useState("全部知识库");
  const [style, setStyle] = useState("严谨引用");
  const activeDocs = docs.filter((item) => item.status !== "trashed");
  const names = collectionNames(activeDocs, collections, { seed: false });
  const indexed = activeDocs.filter((item) => item.status === "indexed");
  const today = new Date().toDateString();
  const addedToday = activeDocs.filter((doc) => new Date(doc.updatedAt).toDateString() === today).length;

  const metrics = [
    { label: "知识库数量", value: names.length, hint: "当前演示知识库", icon: BookOpen },
    { label: "文档总数", value: activeDocs.length, hint: "当前演示文档", icon: FileText },
    { label: "今日新增", value: addedToday, hint: "按文档更新时间统计", icon: ChartNoAxesCombined },
    { label: "检索次数", value: searches, hint: "本地演示计数", icon: Search },
    { label: "问答次数", value: asks, hint: "本地演示计数", icon: MessageSquare },
  ];

  const quickActions = [
    { label: "上传文档", icon: UploadCloud, action: () => void navigate({ to: "/upload" }) },
    { label: "智能检索", icon: Search, action: () => void navigate({ to: "/search", search: { q: "" } }) },
    { label: "AI 问答", icon: MessageSquare, action: () => void navigate({ to: "/ask" }) },
    { label: "知识管理", icon: FolderKanban, action: () => void navigate({ to: "/library" }) },
    { label: "权限设置", icon: ShieldCheck, action: () => void navigate({ to: "/permissions" }) },
    { label: "审计日志", icon: ClipboardList, action: () => void navigate({ to: "/audit" }) },
    { label: "创建助手", icon: Bot, action: () => setAssistantOpen(true) },
    { label: "个人中心", icon: UserRound, action: () => document.getElementById("modao-personal-center")?.click() },
  ];

  return (
    <div className="modao-home">
      <div className="modao-home-heading">
        <h1>首页</h1>
        <p>欢迎使用 AI 智能知识库</p>
      </div>

      <div className="modao-metrics">
        {metrics.map(({ label, value, hint, icon: Icon }) => (
          <div key={label} className="modao-metric">
            <div className="modao-metric-top">
              <span>{label}</span>
              <Icon size={17} strokeWidth={1.7} aria-hidden="true" />
            </div>
            <strong>{value.toLocaleString("zh-CN")}</strong>
            <small>{hint}</small>
          </div>
        ))}
      </div>

      <section className="modao-panel modao-quick-panel" aria-label="快捷入口">
        <h2>快捷入口</h2>
        <div className="modao-actions">
          {quickActions.map(({ label, icon: Icon, action }) => (
            <button key={label} type="button" onClick={action} className="modao-action">
              <span className="modao-action-icon"><Icon size={21} strokeWidth={2} /></span>
              <span>{label}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="modao-lower-grid">
        <section className="modao-panel modao-info-panel" aria-label="最近动态">
          <div className="modao-section-header">
            <h2>最近动态</h2>
            <Link to="/audit">查看全部</Link>
          </div>
          <div className="modao-events">
            {logs.slice(0, 4).map((log, index) => {
              const Icon = [UploadCloud, Search, MessageSquare, FolderKanban][index];
              return (
                <div className="modao-event" key={log.id}>
                  <span className="modao-event-icon"><Icon size={16}/></span>
                  <div>
                    <strong>{log.action}</strong>
                    <p>{log.target}</p>
                    <small>{new Date(log.createdAt).toLocaleString("zh-CN")}</small>
                  </div>
                </div>
              );
            })}
            {logs.length === 0 ? <p className="modao-empty">暂无动态</p> : null}
          </div>
        </section>
        <section className="modao-panel modao-info-panel" aria-label="热门知识排行">
          <div className="modao-section-header">
            <h2>热门知识排行</h2>
            <Link to="/library">查看全部</Link>
          </div>
          <ol className="modao-ranking">
            {indexed.slice(0, 5).map((doc, index) => (
              <li key={doc.id}>
                <span className="modao-rank">{index + 1}</span>
                <div>
                  <strong>{doc.title}</strong>
                  <small>已索引 · {doc.chunks.length} 个切片</small>
                </div>
                <button
                  type="button"
                  aria-label={`检索 ${doc.title}`}
                  title="检索此文档"
                  onClick={() => void navigate({ to: "/search", search: { q: doc.title } })}
                >
                  <Eye size={16} />
                </button>
              </li>
            ))}
            {indexed.length === 0 ? <p className="modao-empty">暂无已索引文档</p> : null}
          </ol>
        </section>
      </div>

      {assistantOpen ? (
        <div className="modao-modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setAssistantOpen(false);
        }}>
          <div className="modao-modal" role="dialog" aria-modal="true" aria-labelledby="assistant-title">
            <div className="modao-modal-title">
              <h2 id="assistant-title">创建 AI 助手</h2>
              <button type="button" onClick={() => setAssistantOpen(false)} aria-label="关闭">×</button>
            </div>
            <label>助手名称
              <input value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label>知识库范围
              <select value={scope} onChange={(event) => setScope(event.target.value)}>
                <option>全部知识库</option>
                {names.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>回答风格
              <select value={style} onChange={(event) => setStyle(event.target.value)}>
                <option>严谨引用</option>
                <option>客服话术</option>
                <option>简短结论</option>
              </select>
            </label>
            <div className="modao-modal-footer">
              <button type="button" onClick={() => setAssistantOpen(false)}>取消</button>
              <button type="button" onClick={() => {
                addAssistant({ name, collection: scope, style });
                setAssistantOpen(false);
                void navigate({ to: "/ask" });
              }}>创建</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
