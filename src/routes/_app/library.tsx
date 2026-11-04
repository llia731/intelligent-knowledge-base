import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { PageTitle, Panel } from "@/components/app-shell";
import { collectionNames } from "@/lib/kb/collections";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";
import type { KbDoc } from "@/lib/kb/types";

export const Route = createFileRoute("/_app/library")({
  component: LibraryPage,
});

const STATUS: Record<KbDoc["status"], string> = {
  indexed: "已索引",
  pending: "待审核",
  rejected: "已驳回",
  trashed: "回收站",
};

function LibraryPage() {
  const docs = useKb((s) => s.docs);
  const removeDoc = useKb((s) => s.trashDocs);
  const restoreDocs = useKb((s) => s.restoreDocs);
  const shareDoc = useKb((s) => s.shareDoc);
  const restoreSeed = useKb((s) => s.restoreSeed);
  const can = useCan();
  const [query, setQuery] = useState("");
  const [collection, setCollection] = useState("全部知识库");
  const names = collectionNames(docs, [], { seed: false, trashed: true });
  const [active, setActive] = useState<KbDoc | null>(null);
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [trash, setTrash] = useState(false);
  const visible = docs.filter((doc) => {
    if (doc.status === "trashed") return trash;
    if (trash) return false;
    if (collection !== "全部知识库" && doc.collection !== collection) return false;
    if (!can("受限知识") && doc.sensitivity === "restricted") return false;
    if (!query.trim()) return true;
    return `${doc.title}${doc.collection}${doc.content}`.includes(query.trim());
  });

  return (
    <div>
      <PageTitle kicker="目录" title="知识管理">
        <button type="button" onClick={() => restoreSeed()} className="min-h-11 rounded-md border border-line px-4 text-sm">
          恢复示例知识
        </button>
      </PageTitle>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="搜索标题或正文"
        className="mb-3 min-h-11 w-full rounded-md border border-line bg-card px-3 text-sm"
      />
      <div className="mb-3 flex flex-wrap gap-2">
        {["全部知识库", ...names].map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setCollection(name)}
            className={collection === name ? "min-h-10 rounded-md bg-ink px-3 text-sm text-paper" : "min-h-10 rounded-md border border-line px-3 text-sm"}
          >
            {name}
          </button>
        ))}
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => setTrash(false)} className={!trash ? "min-h-10 rounded-md bg-ink px-3 text-paper" : "min-h-10 rounded-md border border-line px-3"}>
          知识库列表
        </button>
        <button type="button" onClick={() => setTrash(true)} className={trash ? "min-h-10 rounded-md bg-ink px-3 text-paper" : "min-h-10 rounded-md border border-line px-3"}>
          回收站
        </button>
        <span className="text-muted">已选 {picked.length} 项</span>
        {picked.length > 0 && !trash ? (
          <button
            type="button"
            className="min-h-10 text-copper"
            onClick={() => {
              removeDoc(picked);
              setPicked([]);
            }}
          >
            移入回收站
          </button>
        ) : null}
        {picked.length > 0 && trash ? (
          <button
            type="button"
            className="min-h-10 text-teal"
            onClick={() => {
              restoreDocs(picked);
              setPicked([]);
            }}
          >
            恢复
          </button>
        ) : null}
      </div>
      {visible.length === 0 ? <p className="mb-4 text-sm text-muted">{trash ? "回收站是空的。" : "没有匹配的文档。"}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-line bg-card">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th className="px-4 py-3 font-medium">选择</th>
              <th className="px-4 py-3 font-medium">文档</th>
              <th className="px-4 py-3 font-medium">知识库</th>
              <th className="px-4 py-3 font-medium">密级</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 font-medium">切片</th>
              <th className="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((doc) => (
              <tr key={doc.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={`选择${doc.title}`}
                    checked={picked.includes(doc.id)}
                    onChange={() =>
                      setPicked((list) => (list.includes(doc.id) ? list.filter((item) => item !== doc.id) : [...list, doc.id]))
                    }
                  />
                </td>
                <td className="px-4 py-3 font-medium">{doc.title}</td>
                <td className="px-4 py-3">{doc.collection}</td>
                <td className="px-4 py-3">
                  {doc.sensitivity === "restricted" ? "受限" : doc.sensitivity === "internal" ? "内部" : "公开"}
                </td>
                <td className="px-4 py-3">{STATUS[doc.status]}</td>
                <td className="px-4 py-3 tabular-nums">{doc.chunks.length}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button type="button" className="min-h-10 px-2" onClick={() => { setActive(doc); setNote(doc.shareNote); }}>
                      查看
                    </button>
                    {trash ? (
                      <button type="button" className="min-h-10 px-2" onClick={() => restoreDocs([doc.id])}>
                        恢复
                      </button>
                    ) : (
                      <button type="button" className="min-h-10 px-2 text-copper" onClick={() => removeDoc([doc.id])}>
                        删除
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {active ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button type="button" aria-label="关闭" className="absolute inset-0 bg-ink/40" onClick={() => setActive(null)} />
          <Panel className="relative z-10 m-4 max-h-[85vh] w-full max-w-2xl overflow-auto p-5">
            <p className="text-xs tracking-widest text-copper">{active.collection}</p>
            <h2 className="mt-1 font-display text-2xl">{active.title}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{active.content}</p>
            {active.shareNote ? <p className="mt-2 text-sm text-muted">分享附言：{active.shareNote}</p> : null}
            {!trash ? (
              <form
                className="mt-4 border-t border-line pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  shareDoc(active.id, note.trim());
                  setActive(null);
                }}
              >
                <label className="text-sm">
                  分享附言
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    rows={2}
                    className="mt-1 w-full rounded-md border border-line px-3 py-2 text-sm"
                  />
                </label>
                <button type="submit" className="mt-2 min-h-11 rounded-md bg-teal px-4 text-sm text-teal-fg">
                  保存分享设置
                </button>
              </form>
            ) : null}
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
