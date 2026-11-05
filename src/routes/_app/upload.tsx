import { createFileRoute, Link } from "@tanstack/react-router";
import { FileUp, FolderOpen, Link2, Pause, Rss, X } from "lucide-react";
import { useRef, useState } from "react";
import { collectionNames } from "@/lib/kb/collections";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";
import type { Sensitivity } from "@/lib/kb/types";

export const Route = createFileRoute("/_app/upload")({ component: UploadPage });

const STEPS = ["读取文本", "敏感检测", "分块", "写入索引"];
const FORMATS = ["PDF", "Word", "Excel", "PPT", "TXT", "Markdown", "OFD", "图片", "音视频"];

type Task = {
  id: string;
  name: string;
  size: string;
  state: "解析中" | "已完成" | "排队中" | "失败";
  demo?: boolean;
};

const DEMO_TASKS: Task[] = [
  { id: "d1", name: "2025 年度产品规划.pdf", size: "24.8 MB", state: "解析中", demo: true },
  { id: "d2", name: "客户线索汇总.xlsx", size: "3.2 MB", state: "已完成", demo: true },
  { id: "d3", name: "产品发布会回放.mp4", size: "128 MB", state: "排队中", demo: true },
];

const TRACK = [
  { label: "排队中", n: 12, tone: "bg-slate-100 text-slate-600" },
  { label: "解析中", n: 5, tone: "bg-blue-50 text-blue-600" },
  { label: "分块中", n: 3, tone: "bg-amber-50 text-amber-600" },
  { label: "向量化中", n: 2, tone: "bg-violet-50 text-violet-600" },
  { label: "已完成", n: 146, tone: "bg-emerald-50 text-emerald-600" },
  { label: "失败", n: 2, tone: "bg-rose-50 text-rose-600" },
];

function UploadPage() {
  const addDocument = useKb((s) => s.addDocument);
  const docs = useKb((s) => s.docs);
  const collections = useKb((s) => s.collections);
  const recordTrace = useKb((s) => s.recordTrace);
  const canReview = useCan()("内容审核");
  const scopes = collectionNames(docs, collections);
  const [title, setTitle] = useState("");
  const [collection, setCollection] = useState(scopes[0] ?? "产品帮助中心");
  const [sensitivity, setSensitivity] = useState<Sensitivity>("internal");
  const [content, setContent] = useState("");
  const [phase, setPhase] = useState(-1);
  const [notice, setNotice] = useState("");
  const [pendingTitle, setPendingTitle] = useState("");
  const [tasks, setTasks] = useState<Task[]>(DEMO_TASKS);
  const [paused, setPaused] = useState(false);
  const [url, setUrl] = useState("https://example.com/article");
  const [rss, setRss] = useState("https://example.com/feed.xml");
  const [article, setArticle] = useState("");
  const pausedRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onFile(file: File) {
    const text = await file.text();
    setContent(text.slice(0, 20000));
    setTitle(file.name.replace(/\.[^.]+$/, ""));
    setNotice(file.type.startsWith("text") || /\.(txt|md|markdown|csv)$/i.test(file.name)
      ? "已读取文本，可直接入库。PDF / Office 解析服务未接入，非文本文件只会保留文件名。"
      : "该格式的解析服务未接入。若文件含可读文本，仍会按文本尝试入库。");
  }

  function submitText() {
    if (content.trim().length < 20 || (phase >= 0 && phase < STEPS.length)) {
      setNotice("请先提供至少 20 字正文，或上传 txt / md / csv。");
      return;
    }
    const name = title.trim() || "未命名文档";
    const taskId = `t-${Date.now()}`;
    setTasks((list) => [{ id: taskId, name, size: `${Math.max(1, Math.round(content.length / 1024))} KB`, state: "解析中" }, ...list]);
    setPhase(0);
    let step = 0;
    const timer = window.setInterval(() => {
      if (pausedRef.current) return;
      step += 1;
      if (step >= STEPS.length) {
        window.clearInterval(timer);
        const result = addDocument({ title: name, collection, content, sensitivity });
        setPhase(-1);
        setTasks((list) => list.map((item) => item.id === taskId ? { ...item, state: result.review ? "排队中" : "已完成" } : item));
        setNotice(result.review
          ? `《${result.doc.title}》已进入人工复核，通过前不会被问答引用。`
          : `《${result.doc.title}》已写入本地索引，共 ${result.doc.chunks.length} 个切片。`);
        setPendingTitle(result.review ? result.doc.title : "");
        recordTrace({
          kind: "知识上传",
          collection,
          query: result.doc.title,
          hits: result.review ? [] : [{ title: result.doc.title, score: result.doc.chunks.length }],
          answer: result.review ? "待审核" : "已索引",
          ms: 280 * STEPS.length,
        });
        setTitle("");
        setContent("");
      } else {
        setPhase(step);
      }
    }, 280);
  }

  function demoCapture(label: string, value: string) {
    if (!value.trim()) return;
    setTasks((list) => [{ id: `c-${Date.now()}`, name: `${label}：${value.trim().slice(0, 42)}`, size: "—", state: "排队中", demo: true }, ...list]);
    setNotice(`${label}服务未接入。已在页面内记下一条演示任务，没有发起网络抓取。`);
  }

  return (
    <div>
      <h1 className="page-h">知识上传</h1>
      <p className="page-sub">支持多格式文档、批量上传与网络内容采集。</p>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <section className="card p-5">
          <div
            className="drop"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const file = event.dataTransfer.files?.[0];
              if (file) void onFile(file);
            }}
          >
            <span className="grid size-12 place-items-center rounded-2xl bg-[var(--m-blue-soft)] text-[var(--m-blue)]">
              <FileUp size={22} />
            </span>
            <p className="mt-3 text-base font-semibold">拖拽文件到此处上传</p>
            <p className="mt-1 text-sm text-[var(--m-sub)]">或将文件直接粘贴，支持单个或批量文件</p>
            <div className="mt-4 flex gap-2">
              <button type="button" className="btn" onClick={() => fileRef.current?.click()}>选择文件</button>
              <button type="button" className="btn ghost" onClick={() => fileRef.current?.click()}><FolderOpen size={14} />选择文件夹</button>
            </div>
            <input ref={fileRef} type="file" className="hidden" onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }} />
          </div>
          <p className="mt-4 text-xs text-[var(--m-faint)]">支持格式</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {FORMATS.map((item) => <span key={item} className="chip">{item}</span>)}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-[var(--m-sub)]">入库标题
              <input className="field mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="文档标题" />
            </label>
            <label className="text-xs text-[var(--m-sub)]">知识库
              <select className="select mt-1" value={collection} onChange={(e) => setCollection(e.target.value)}>
                {scopes.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="text-xs text-[var(--m-sub)]">密级
              <select className="select mt-1" value={sensitivity} onChange={(e) => setSensitivity(e.target.value as Sensitivity)}>
                <option value="public">公开</option>
                <option value="internal">内部</option>
                <option value="restricted">受限（需审核）</option>
              </select>
            </label>
          </div>
          <textarea className="area mt-3" rows={4} value={content} onChange={(e) => setContent(e.target.value)} placeholder="粘贴正文。含身份证号、薪资明细、机密字样会进入复核。这是为实现入库闭环补充的字段。" />
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button type="button" className="btn" disabled={phase >= 0} onClick={submitText}>{phase >= 0 ? STEPS[phase] : "开始入库"}</button>
            <button type="button" className="btn ghost" onClick={() => { pausedRef.current = !pausedRef.current; setPaused(!paused); }}>
              <Pause size={14} />{paused ? "继续" : "暂停流水线"}
            </button>
            {pendingTitle && canReview ? <Link to="/admin/review" className="text-sm text-[var(--m-blue)]">去审核《{pendingTitle}》</Link> : null}
          </div>
          {notice ? <p className="note mt-2">{notice}</p> : null}
        </section>

        <section className="card p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold"><Link2 size={16} />网络内容采集</h2>
          <p className="note mt-1">以下按钮不会访问外网，只记录演示任务。</p>
          <label className="mt-4 block text-sm font-medium">URL 抓取
            <div className="mt-2 flex gap-2">
              <input className="field" value={url} onChange={(e) => setUrl(e.target.value)} />
              <button type="button" className="btn" onClick={() => demoCapture("URL 抓取", url)}>抓取</button>
            </div>
          </label>
          <label className="mt-3 block text-sm font-medium">RSS 订阅
            <div className="mt-2 flex gap-2">
              <input className="field" value={rss} onChange={(e) => setRss(e.target.value)} />
              <button type="button" className="btn" onClick={() => demoCapture("RSS", rss)}>订阅</button>
            </div>
          </label>
          <label className="mt-3 block text-sm font-medium">公众号文章
            <div className="mt-2 flex gap-2">
              <input className="field" value={article} placeholder="粘贴公众号文章链接" onChange={(e) => setArticle(e.target.value)} />
              <button type="button" className="btn" onClick={() => demoCapture("公众号", article)}>采集</button>
            </div>
          </label>
          <p className="mt-4 text-sm font-medium">第三方同步</p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" className="btn ghost" onClick={() => demoCapture("语雀", "语雀空间")}><Rss size={14} />语雀</button>
            <button type="button" className="btn ghost" onClick={() => demoCapture("飞书", "飞书知识库")}><Rss size={14} />飞书</button>
          </div>
        </section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_360px]">
        <section className="card p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">批量上传进度 <span className="text-xs font-normal text-[var(--m-sub)]">{tasks.length} 个任务</span></h2>
            <div className="flex gap-2">
              <button type="button" className="btn ghost" onClick={() => setTasks((list) => list.map((item) => item.state === "解析中" ? { ...item, state: "排队中" } : item))}>全部暂停</button>
              <button type="button" className="btn ghost" onClick={() => setTasks((list) => list.filter((item) => !item.demo && item.state === "已完成"))}>全部取消</button>
            </div>
          </div>
          <ul className="divide-y divide-[var(--m-line)]">
            {tasks.map((task) => (
              <li key={task.id} className="flex items-center gap-3 py-3">
                <span className="grid size-9 place-items-center rounded-lg bg-[var(--m-paper)] text-[var(--m-blue)]"><FileUp size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{task.name}</p>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#eef1f5]">
                    <div className="h-full rounded-full" style={{ width: task.state === "已完成" ? "100%" : task.state === "解析中" ? "62%" : "18%", background: task.state === "已完成" ? "#16a34a" : "#1d6cff" }} />
                  </div>
                </div>
                <span className="text-xs text-[var(--m-sub)]">{task.size}</span>
                <span className={task.state === "已完成" ? "tag green" : task.state === "失败" ? "tag red" : "tag blue"}>{task.state}</span>
                <button type="button" aria-label="移除" className="icon-btn" onClick={() => setTasks((list) => list.filter((item) => item.id !== task.id))}><X size={14} /></button>
              </li>
            ))}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="text-base font-semibold">处理状态追踪</h2>
          <p className="note mb-2">计数为原型示例，不是解析集群的实时队列。</p>
          <ul className="space-y-2">
            {TRACK.map((item) => (
              <li key={item.label} className="flex items-center justify-between rounded-xl bg-[var(--m-paper)] px-3 py-2">
                <span className="flex items-center gap-2 text-sm"><span className={`size-2 rounded-full ${item.tone.split(" ")[0]}`} />{item.label}</span>
                <b>{item.n}</b>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card mt-4 p-5">
        <h2 className="text-base font-semibold">多模态解析</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {[
            ["音频转写", "语音转文本"],
            ["视频转写", "字幕与摘要"],
            ["图片 OCR", "文字识别"],
            ["图纸表格", "工程图解析"],
            ["扫描件 PDF", "OCR 后结构化"],
          ].map(([title, desc]) => (
            <button key={title} type="button" className="rounded-xl bg-[var(--m-paper)] px-3 py-4 text-center" onClick={() => setNotice(`${title}未接入解析服务，当前仅支持文本入库。`)}>
              <p className="text-sm font-medium">{title}</p>
              <p className="text-xs text-[var(--m-sub)]">{desc}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
