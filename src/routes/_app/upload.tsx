import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { PageTitle, Panel } from "@/components/app-shell";
import { collectionNames } from "@/lib/kb/collections";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";
import type { Sensitivity } from "@/lib/kb/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/upload")({
  component: UploadPage,
});

const STEPS = ["读取文本", "敏感检测", "分块", "写入索引"];

function UploadPage() {
  const addDocument = useKb((s) => s.addDocument);
  const docs = useKb((s) => s.docs);
  const collections = useKb((s) => s.collections);
  const recordTrace = useKb((s) => s.recordTrace);
  const canReview = useCan()("内容审核");
  const [pendingTitle, setPendingTitle] = useState("");
  const scopes = collectionNames(docs, collections);
  const [title, setTitle] = useState("");
  const [collection, setCollection] = useState(scopes[0] ?? "");
  const [sensitivity, setSensitivity] = useState<Sensitivity>("internal");
  const [content, setContent] = useState("");
  const [phase, setPhase] = useState(-1);
  const [notice, setNotice] = useState("");
  const [paused, setPaused] = useState(false);
  const pausedRef = useRef(false);

  async function onFile(file: File) {
    const text = await file.text();
    setContent(text.slice(0, 20000));
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
  }

  function submit() {
    if (content.trim().length < 20 || phase >= 0 && phase < STEPS.length) return;
    setPhase(0);
    setNotice("");
    let step = 0;
    const timer = window.setInterval(() => {
      if (pausedRef.current) return;
      step += 1;
      if (step >= STEPS.length) {
        window.clearInterval(timer);
        const result = addDocument({ title, collection, content, sensitivity });
        setPhase(-1);
        setNotice(
          result.review
            ? `《${result.doc.title}》已进入人工复核，通过前不会被问答引用。`
            : `《${result.doc.title}》已索引，共 ${result.doc.chunks.length} 个切片，现在可以检索。`,
        );
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

  return (
    <div>
      <PageTitle kicker="入库" title="知识上传" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Panel className="p-4 sm:p-5">
          <div className="grid gap-3">
            <label className="text-sm">
              标题
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 min-h-11 w-full rounded-md border border-line bg-card px-3 text-sm"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-sm">
                知识库
                <select
                  value={collection}
                  onChange={(event) => setCollection(event.target.value)}
                  className="mt-1 min-h-11 w-full rounded-md border border-line bg-card px-3 text-sm"
                >
                  {scopes.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                密级
                <select
                  value={sensitivity}
                  onChange={(event) => setSensitivity(event.target.value as Sensitivity)}
                  className="mt-1 min-h-11 w-full rounded-md border border-line bg-card px-3 text-sm"
                >
                  <option value="public">公开</option>
                  <option value="internal">内部</option>
                  <option value="restricted">受限（需审核，仅管理员召回）</option>
                </select>
              </label>
            </div>
            <label className="text-sm">
              正文
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={10}
                placeholder="粘贴制度正文，或上传 txt / md 文件。含身份证号、薪资明细、机密字样会进入复核。"
                className="mt-1 w-full rounded-md border border-line bg-card px-3 py-2 text-sm leading-6"
              />
            </label>
            <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-md border border-dashed border-line text-sm text-muted">
              选择文本文件
              <input
                type="file"
                accept=".txt,.md,.markdown,.csv,text/plain"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void onFile(file);
                }}
              />
            </label>
            <button
              type="button"
              onClick={submit}
              disabled={content.trim().length < 20 || phase >= 0}
              className="min-h-11 rounded-md bg-teal text-sm font-medium text-teal-fg disabled:opacity-50"
            >
              提交并索引
            </button>
            {notice ? <p className="text-sm text-ok">{notice}</p> : null}
            {pendingTitle && canReview ? (
              <Link to="/admin/review" className="inline-flex min-h-11 items-center text-sm font-medium text-teal">
                去审核《{pendingTitle}》
              </Link>
            ) : null}
          </div>
        </Panel>
        <Panel className="p-4">
          <h2 className="text-sm font-medium">处理进度</h2>
          <ol className="mt-3 space-y-2">
            {STEPS.map((label, index) => (
              <li
                key={label}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-md px-3 text-sm",
                  phase === index ? "bg-teal text-teal-fg" : phase > index ? "bg-ok-bg text-ok" : "bg-paper text-muted",
                )}
              >
                <span className="tabular-nums">{index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <h2 className="mt-6 text-sm font-medium">上传进度</h2>
          <button
            type="button"
            className="mt-2 min-h-10 text-sm text-copper"
            onClick={() => {
              pausedRef.current = !pausedRef.current;
              setPaused(pausedRef.current);
            }}
          >
            {paused ? "继续" : "暂停当前处理"}
          </button>
          <p className="mt-2 text-sm text-muted">{phase >= 0 ? `正在处理第 ${phase + 1} 步` : "没有进行中的任务"}</p>
          <h2 className="mt-6 text-sm font-medium">最近文档</h2>
          <ul className="mt-2 space-y-2 text-sm">
            {docs.slice(0, 5).map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{doc.title}</span>
                <span className="shrink-0 text-xs text-muted">
                  {doc.status === "indexed" ? "已索引" : doc.status === "pending" ? "待审核" : "已驳回"}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
