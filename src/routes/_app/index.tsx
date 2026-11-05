import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  Bot,
  ClipboardList,
  FileText,
  FolderKanban,
  MessageSquare,
  Search,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { collectionNames } from "@/lib/kb/collections";
import { useKb } from "@/lib/kb/store";

export const Route = createFileRoute("/_app/")({ component: HomePage });

const STATS = [
  { label: "知识库数量", value: "12", delta: "+2 本月新增" },
  { label: "文档总数", value: "3,842", delta: "+56 今日新增" },
  { label: "今日新增", value: "56", delta: "较昨日 +12%" },
  { label: "检索次数", value: "1,208", delta: "+89 较昨日" },
  { label: "问答次数", value: "486", delta: "+34 较昨日" },
];

const FEED = [
  { title: "最近上传", desc: "《产品需求规范 V2.1.pdf》已上传至「产品设计」知识库", time: "10 分钟前" },
  { title: "最近检索", desc: "关键词「API 鉴权流程」命中 7 篇文档", time: "32 分钟前" },
  { title: "最近问答", desc: "用户询问「如何配置向量数据库索引？」", time: "1 小时前" },
  { title: "最近共享", desc: "《上线检查清单》被共享给「运维团队」", time: "2 小时前" },
];

const RANK = [
  { title: "AI 智能知识库产品白皮书", views: "浏览 2,341 次" },
  { title: "RAG 检索增强生成实践指南", views: "浏览 1,892 次" },
  { title: "向量数据库选型对比", views: "浏览 1,456 次" },
  { title: "大模型 Prompt 工程手册", views: "浏览 1,103 次" },
  { title: "企业知识治理规范", views: "浏览 987 次" },
];

const GAPS = [
  { title: "API 错误码说明", desc: "检索高频提问但缺少文档" },
  { title: "权限矩阵表", desc: "权限配置指引不完整" },
  { title: "数据安全备份流程", desc: "运维相关知识待补充" },
  { title: "模型调用配额说明", desc: "费用与限额文档缺失" },
];

function HomePage() {
  const navigate = useNavigate();
  const docs = useKb((s) => s.docs);
  const collections = useKb((s) => s.collections);
  const addAssistant = useKb((s) => s.addAssistant);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [name, setName] = useState("制度问答助手");
  const [scope, setScope] = useState("全部知识库");
  const [style, setStyle] = useState("严谨引用");
  const names = collectionNames(docs.filter((d) => d.status !== "trashed"), collections, { seed: false });

  const shortcuts: { label: string; icon: typeof Upload; run: () => void }[] = [
    { label: "上传文档", icon: Upload, run: () => void navigate({ to: "/upload" }) },
    { label: "智能检索", icon: Search, run: () => void navigate({ to: "/search", search: { q: "" } }) },
    { label: "AI 问答", icon: MessageSquare, run: () => void navigate({ to: "/ask" }) },
    { label: "知识管理", icon: FolderKanban, run: () => void navigate({ to: "/library" }) },
    { label: "权限设置", icon: ShieldCheck, run: () => void navigate({ to: "/permissions" }) },
    { label: "审计日志", icon: ClipboardList, run: () => void navigate({ to: "/audit" }) },
    { label: "创建助手", icon: Bot, run: () => setAssistantOpen(true) },
    { label: "个人中心", icon: UserRound, run: () => document.getElementById("modao-personal-center")?.click() },
  ];

  return (
    <div>
      <h1 className="page-h">首页</h1>
      <p className="page-sub">欢迎使用 AI 智能知识库</p>

      <div className="mt-5 grid grid-cols-2 gap-4 xl:grid-cols-5">
        {STATS.map((item) => (
          <article key={item.label} className="stat" title="原型示例指标，不是生产运营数据">
            <div className="flex items-start justify-between">
              <p className="k">{item.label}</p>
              <span className="ico"><FileText size={14} /></span>
            </div>
            <p className="v">{item.value}</p>
            <p className="d">{item.delta}</p>
          </article>
        ))}
      </div>

      <section className="card mt-4 p-4 sm:p-5">
        <h2 className="text-sm font-semibold">快捷入口</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {shortcuts.map((item) => (
            <button key={item.label} type="button" className="quick" onClick={item.run}>
              <span className="bubble"><item.icon size={18} /></span>
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <section className="card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">最近动态</h2>
            <Link to="/audit" className="text-xs text-[var(--m-blue)]">查看全部</Link>
          </div>
          <ul className="space-y-3">
            {FEED.map((item) => (
              <li key={item.title} className="flex gap-3">
                <span className="mt-0.5 grid size-8 place-items-center rounded-full bg-[var(--m-blue-soft)] text-[var(--m-blue)]">
                  <FileText size={14} />
                </span>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs text-[var(--m-sub)]">{item.desc}</p>
                  <p className="text-xs text-[var(--m-faint)]">{item.time}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">热门知识排行</h2>
            <Link to="/library" className="text-xs text-[var(--m-blue)]">查看全部</Link>
          </div>
          <ol className="space-y-2">
            {RANK.map((item, index) => (
              <li key={item.title}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl bg-[var(--m-paper)] px-3 py-2 text-left"
                  onClick={() => void navigate({ to: "/search", search: { q: item.title } })}
                >
                  <span className="grid size-5 place-items-center rounded-md bg-[#f4f6f8] text-xs font-semibold">{index + 1}</span>
                  <span>
                    <span className="block text-sm font-medium">{item.title}</span>
                    <span className="block text-xs text-[var(--m-sub)]">{item.views}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <section className="card mt-4 p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">知识缺口提醒</h2>
          <span className="text-xs text-[var(--m-blue)]">待补充 8 项</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {GAPS.map((item) => (
            <button
              key={item.title}
              type="button"
              className="rounded-xl border border-dashed border-[var(--m-line)] px-3 py-3 text-left"
              onClick={() => void navigate({ to: "/search", search: { q: item.title } })}
            >
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-[var(--m-sub)]">{item.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {assistantOpen ? (
        <div className="overlay" onClick={() => setAssistantOpen(false)}>
          <form
            className="modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              addAssistant({ name: name.trim() || "未命名助手", collection: scope, style });
              setAssistantOpen(false);
              void navigate({ to: "/ask" });
            }}
          >
            <h2 className="text-lg font-semibold">创建 AI 助手</h2>
            <p className="page-sub">助手会带上知识库范围和回答风格。模型仍从服务端目录读取。</p>
            <label className="mt-3 block text-sm">名称
              <input className="field mt-1" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="mt-3 block text-sm">知识库范围
              <select className="select mt-1" value={scope} onChange={(e) => setScope(e.target.value)}>
                <option>全部知识库</option>
                {names.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-sm">回答风格
              <select className="select mt-1" value={style} onChange={(e) => setStyle(e.target.value)}>
                <option>严谨引用</option>
                <option>客服话术</option>
                <option>简短结论</option>
              </select>
            </label>
            <div className="mt-4 flex gap-2">
              <button className="btn" type="submit">创建并去问答</button>
              <button className="btn ghost" type="button" onClick={() => setAssistantOpen(false)}>取消</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
