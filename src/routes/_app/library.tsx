import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { collectionNames } from "@/lib/kb/collections";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";
import type { KbDoc } from "@/lib/kb/types";

export const Route = createFileRoute("/_app/library")({ component: LibraryPage });

const LEVEL: Record<KbDoc["sensitivity"], string> = { public: "公开", internal: "内部", restricted: "机密" };

function LibraryPage() {
  const docs = useKb((s) => s.docs);
  const collections = useKb((s) => s.collections);
  const addCollection = useKb((s) => s.addCollection);
  const trashDocs = useKb((s) => s.trashDocs);
  const removeDoc = useKb((s) => s.removeDoc);
  const restoreDocs = useKb((s) => s.restoreDocs);
  const shareDoc = useKb((s) => s.shareDoc);
  const updateDoc = useKb((s) => s.updateDoc);
  const restoreSeed = useKb((s) => s.restoreSeed);
  const canRestricted = useCan()("受限知识");
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("全部");
  const [trash, setTrash] = useState(false);
  const [view, setView] = useState<"列表" | "卡片">("列表");
  const [picked, setPicked] = useState<string[]>([]);
  const [active, setActive] = useState<KbDoc | null>(null);
  const [dialog, setDialog] = useState<"view" | "edit" | "share" | null>(null);
  const [note, setNote] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editCollection, setEditCollection] = useState("");
  const [editLevel, setEditLevel] = useState<KbDoc["sensitivity"]>("internal");
  const [line, setLine] = useState("全部");
  const [level, setLevel] = useState("全部");
  const [kind, setKind] = useState("全部");
  const [tag, setTag] = useState("");
  const [creating, setCreating] = useState(false);
  const [kbName, setKbName] = useState("");
  const [notice, setNotice] = useState("");
  const names = collectionNames(docs, collections, { trashed: true });

  const rows = useMemo(() => docs.filter((doc) => {
    if (trash ? doc.status !== "trashed" : doc.status === "trashed") return false;
    if (!canRestricted && doc.sensitivity === "restricted") return false;
    if (collection !== "全部" && doc.collection !== collection) return false;
    if (level === "公开" && doc.sensitivity !== "public") return false;
    if (level === "内部" && doc.sensitivity !== "internal") return false;
    if (level === "机密" && doc.sensitivity !== "restricted") return false;
    if (line !== "全部") {
      const blob = `${doc.collection} ${doc.title}`;
      const ok =
        (line === "研发" && /产品|制度|检索|IT|设备/.test(blob)) ||
        (line === "产品" && /产品|帮助/.test(blob)) ||
        (line === "运营" && /入职|财务|报销|年假/.test(blob)) ||
        (line === "市场" && /市场|竞品/.test(blob));
      if (!ok) return false;
    }
    if (kind !== "全部") {
      const ext = doc.title.split(".").pop()?.toLowerCase() ?? "";
      if (kind === "网页" && ext !== "html") return false;
      if (kind === "文档" && !/pdf|docx|md|txt/.test(ext) && doc.title.includes(".")) return false;
    }
    const blob = `${doc.title} ${doc.collection} ${doc.owner} ${doc.content}`.toLowerCase();
    if (tag && !blob.includes(tag.toLowerCase())) return false;
    return blob.includes(query.trim().toLowerCase());
  }), [docs, trash, canRestricted, collection, query, line, level, kind, tag]);

  const cards = [
    { name: "产品研发知识库", desc: "覆盖产品规划、需求文档、技术方案与迭代记录。", level: "全员可读", meta: "128 文档 · 2.4 GB" },
    { name: "客户支持知识库", desc: "FAQ、工单处理话术、售后流程与典型案例。", level: "内部", meta: "86 文档 · 1.1 GB" },
    { name: "内部规章制度", desc: "人事、财务、信息安全与合规相关政策文件。", level: "内部", meta: "34 文档 · 320 MB" },
  ];

  function openDoc(doc: KbDoc, next: "view" | "edit" | "share") {
    setActive(doc);
    setDialog(next);
    setNote(doc.shareNote);
    setEditTitle(doc.title);
    setEditBody(doc.content);
    setEditCollection(doc.collection);
    setEditLevel(doc.sensitivity);
  }

  function toggle(id: string) {
    setPicked((list) => list.includes(id) ? list.filter((item) => item !== id) : [...list, id]);
  }

  return (
    <div>
      <div className="head-row">
        <div>
          <h1 className="page-h">知识管理</h1>
          <p className="page-sub">知识库、文档、分类与版本管理</p>
        </div>
        <button type="button" className="btn" onClick={() => setCreating(true)}>新建知识库</button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="card h-fit p-4">
          <h2 className="text-sm font-semibold">分类导航</h2>
          <FilterGroup title="业务线" value={line} onChange={setLine} options={["研发", "产品", "运营", "市场"]} />
          <FilterGroup title="密级" value={level} onChange={setLevel} options={["公开", "内部", "机密"]} />
          <FilterGroup title="文档类型" value={kind} onChange={setKind} options={["文档", "网页"]} />
          <p className="note mt-3">分类按当前本地文档筛选。原型上的 86、42 等数字是示意计数，这里不照抄。</p>
          <h2 className="mt-4 text-sm font-semibold">热门标签</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {["API 文档", "设计规范", "会议纪要", "运维手册", "产品需求", "测试报告", "客户案例", "大模型", "数据安全"].map((item) => (
              <button key={item} type="button" className="chip" onClick={() => setTag(tag === item ? "" : item)}>{item}</button>
            ))}
          </div>
          {tag ? <button type="button" className="mt-2 text-xs text-[var(--m-blue)]" onClick={() => setTag("")}>清除标签：{tag}</button> : null}
          <div className="mt-3 space-y-1">
            {names.map((name) => (
              <button key={name} type="button" className="flex w-full justify-between text-sm" onClick={() => setCollection(collection === name ? "全部" : name)}>
                <span>{name}</span>
                <span className="text-xs text-[var(--m-faint)]">{docs.filter((d) => d.collection === name && d.status !== "trashed").length}</span>
              </button>
            ))}
          </div>
        </aside>
        <div>
          <section className="card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">知识库列表</h2>
              <button type="button" className="text-sm text-[var(--m-blue)]" onClick={() => setNotice("卡片数量为原型示例。下方表格是本地知识库里的真实文档。")}>查看全部</button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {cards.map((card) => (
                <article key={card.name} className="rounded-xl bg-[var(--m-paper)] p-3">
                  <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">{card.name}</h3><span className="tag">{card.level}</span></div>
                  <p className="mt-2 text-xs text-[var(--m-sub)]">{card.desc}</p>
                  <p className="mt-2 text-xs">{card.meta}</p>
                </article>
              ))}
            </div>
            {collections.length > 0 ? <p className="note mt-2">已创建：{collections.join("、")}</p> : null}
          </section>

          <section className="card mt-4 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-semibold">文档管理</h2>
              <div className="seg">
                {(["列表", "卡片"] as const).map((item) => (
                  <button key={item} type="button" className={view === item ? "on" : ""} onClick={() => setView(item)}>{item}</button>
                ))}
              </div>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <input className="field max-w-xs" placeholder="搜索标题" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button type="button" className="btn ghost" onClick={() => setTrash((v) => !v)}>{trash ? "返回文档" : "回收站"}</button>
              <button type="button" className="btn ghost" onClick={() => restoreSeed()}>恢复示例</button>
              <span className="text-xs text-[var(--m-sub)]">已选 {picked.length} 项</span>
              <button type="button" className="btn ghost" onClick={() => setPicked(picked.length === rows.length ? [] : rows.map((doc) => doc.id))}>全选</button>
              <button type="button" className="btn ghost" disabled={!picked.length || trash} onClick={() => { trashDocs(picked); setPicked([]); }}>删除</button>
              <button type="button" className="btn ghost" disabled={!picked.length || !trash} onClick={() => { restoreDocs(picked); setPicked([]); }}>恢复</button>
              <button type="button" className="btn ghost" onClick={() => setNotice("移动、打标签、改分类、导出尚未接入独立服务，当前只支持删除、恢复、编辑和分享附言。")}>打标签</button>
            </div>
            {notice ? <p className="note mb-2">{notice}</p> : null}
            {view === "列表" ? (
              <div className="overflow-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>选择</th><th>标题</th><th>类型</th><th>大小</th><th>标签</th><th>分类</th><th>更新时间</th><th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((doc) => (
                      <tr key={doc.id}>
                        <td><input type="checkbox" checked={picked.includes(doc.id)} onChange={() => toggle(doc.id)} aria-label={`选择 ${doc.title}`} /></td>
                        <td className="font-medium">{doc.title}</td>
                        <td>{doc.title.includes(".") ? doc.title.split(".").pop() : "文档"}</td>
                        <td>{Math.max(1, Math.round(doc.content.length / 1024))} KB</td>
                        <td>{doc.collection}</td>
                        <td>{doc.collection}</td>
                        <td>{doc.updatedAt.slice(0, 10)}</td>
                        <td className="whitespace-nowrap">
                          <button type="button" className="text-sm text-[var(--m-blue)]" onClick={() => openDoc(doc, "view")}>查看</button>
                          {doc.status !== "trashed" ? (
                            <>
                              <button type="button" className="ml-2 text-sm text-[var(--m-blue)]" onClick={() => openDoc(doc, "edit")}>编辑</button>
                              <button type="button" className="ml-2 text-sm text-[var(--m-blue)]" onClick={() => openDoc(doc, "share")}>分享</button>
                              <button type="button" className="ml-2 text-sm text-[var(--m-blue)]" onClick={() => removeDoc(doc.id)}>删除</button>
                            </>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length === 0 ? <p className="p-4 text-sm text-[var(--m-sub)]">没有文档。</p> : null}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {rows.map((doc) => (
                  <button key={doc.id} type="button" className="rounded-xl border border-[var(--m-line)] p-3 text-left" onClick={() => openDoc(doc, "view")}>
                    <p className="font-medium">{doc.title}</p>
                    <p className="text-xs text-[var(--m-sub)]">{doc.collection} · {LEVEL[doc.sensitivity]}</p>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {creating ? (
        <div className="overlay" onClick={() => setCreating(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={(event) => {
            event.preventDefault();
            if (!kbName.trim()) return;
            addCollection(kbName.trim());
            setKbName("");
            setCreating(false);
          }}>
            <h2 className="text-lg font-semibold">新建知识库</h2>
            <input className="field mt-3" value={kbName} onChange={(e) => setKbName(e.target.value)} placeholder="知识库名称" />
            <div className="mt-4 flex gap-2">
              <button className="btn" type="submit">创建</button>
              <button className="btn ghost" type="button" onClick={() => setCreating(false)}>取消</button>
            </div>
          </form>
        </div>
      ) : null}

      {active && dialog ? (
        <div className="overlay" onClick={() => setDialog(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={(event) => {
            event.preventDefault();
            if (dialog === "share") shareDoc(active.id, note.trim());
            if (dialog === "edit") {
              updateDoc(active.id, { title: editTitle, content: editBody, collection: editCollection, sensitivity: editLevel });
            }
            setDialog(null);
          }}>
            <h2 className="text-lg font-semibold">{dialog === "share" ? "分享文档" : dialog === "edit" ? "编辑文档" : active.title}</h2>
            <p className="page-sub">{active.collection} · {LEVEL[active.sensitivity]} · {active.owner}</p>
            {dialog === "edit" ? (
              <>
                <label className="mt-3 block text-sm">标题<input className="field mt-1" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></label>
                <label className="mt-3 block text-sm">分类<input className="field mt-1" value={editCollection} onChange={(e) => setEditCollection(e.target.value)} /></label>
                <label className="mt-3 block text-sm">密级
                  <select className="select mt-1" value={editLevel} onChange={(e) => setEditLevel(e.target.value as KbDoc["sensitivity"])}>
                    <option value="public">公开</option>
                    <option value="internal">内部</option>
                    <option value="restricted">机密</option>
                  </select>
                </label>
                <textarea className="area mt-3" value={editBody} onChange={(e) => setEditBody(e.target.value)} />
              </>
            ) : (
              <p className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-sm leading-6">{active.content}</p>
            )}
            {dialog === "share" && active.status !== "trashed" ? (
              <label className="mt-3 block text-sm">分享附言
                <textarea className="area mt-1" value={note} onChange={(e) => setNote(e.target.value)} />
              </label>
            ) : null}
            {dialog === "share" && active.shareNote ? <p className="note mt-2">已有附言：{active.shareNote}</p> : null}
            <div className="mt-4 flex gap-2">
              {dialog !== "view" && active.status !== "trashed" ? <button className="btn" type="submit">{dialog === "share" ? "保存分享附言" : "保存"}</button> : null}
              <button className="btn ghost" type="button" onClick={() => setDialog(null)}>关闭</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function FilterGroup({ title, value, onChange, options }: { title: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-[var(--m-sub)]">{title}</p>
      <div className="mt-1 space-y-1">
        {options.map((item) => (
          <button key={item} type="button" className="flex w-full text-sm" onClick={() => onChange(value === item ? "全部" : item)}>
            <span className={value === item ? "text-[var(--m-blue)]" : ""}>{item}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
