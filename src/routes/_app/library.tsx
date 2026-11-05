import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import "./library-visual.css";
import { collectionNames } from "@/lib/kb/collections";
import { useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";
import type { KbDoc } from "@/lib/kb/types";
import { ShareDocumentDialog } from "@/components/kb/share-document-dialog";

export const Route = createFileRoute("/_app/library")({ component: LibraryPage });
const LEVEL: Record<KbDoc["sensitivity"], string> = {
  public: "公开",
  internal: "内部",
  restricted: "机密",
};
const PAGE_SIZE = 4;
const LINES = [
  { name: "研发", icon: "development" },
  { name: "产品", icon: "product" },
  { name: "运营", icon: "operations" },
  { name: "市场", icon: "marketing" },
];
const PROJECTS = [
  { name: "Project Alpha", icon: "project-alpha" },
  { name: "Project Beta", icon: "project-beta" },
];
const KINDS = [
  { name: "PDF", icon: "pdf" },
  { name: "Word", icon: "word" },
  { name: "Markdown", icon: "markdown" },
  { name: "网页", icon: "web" },
];
const TAGS = [
  "API 文档",
  "设计规范",
  "会议纪要",
  "运维手册",
  "产品需求",
  "测试报告",
  "客户案例",
  "大模型",
  "数据安全",
  "onboarding",
];
function LibraryIcon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <img src={`/modao/library/${name}.svg`} width={size} height={size} alt="" aria-hidden="true" />
  );
}
function documentType(doc: KbDoc) {
  const ext = doc.title.split(".").pop()?.toLowerCase();
  return (
    (
      { pdf: "PDF", doc: "Word", docx: "Word", md: "Markdown", html: "网页" } as Record<
        string,
        string
      >
    )[ext || ""] || "文档"
  );
}
function inCategory(doc: KbDoc, category: string) {
  return doc.collection.split(/\s*\/\s*/).includes(category);
}
function LibraryPage() {
  const docs = useKb((s) => s.docs);
  const collections = useKb((s) => s.collections);
  const addCollection = useKb((s) => s.addCollection);
  const trashDocs = useKb((s) => s.trashDocs);
  const removeDoc = useKb((s) => s.removeDoc);
  const restoreDocs = useKb((s) => s.restoreDocs);
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
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editCollection, setEditCollection] = useState("");
  const [editLevel, setEditLevel] = useState<KbDoc["sensitivity"]>("internal");
  const [line, setLine] = useState("全部");
  const [project, setProject] = useState("全部");
  const [level, setLevel] = useState("全部");
  const [kind, setKind] = useState("全部");
  const [tag, setTag] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [kbName, setKbName] = useState("");
  const accessibleDocs = docs.filter((doc) => canRestricted || doc.sensitivity !== "restricted");
  const liveDocs = accessibleDocs.filter((doc) => doc.status !== "trashed");
  const names = collectionNames(accessibleDocs, collections, { trashed: true });
  useEffect(() => {
    setPage(1);
    setPicked([]);
  }, [query, collection, trash, line, project, level, kind, tag, canRestricted]);
  const rows = useMemo(
    () =>
      docs.filter((doc) => {
        if (trash ? doc.status !== "trashed" : doc.status === "trashed") return false;
        if (!canRestricted && doc.sensitivity === "restricted") return false;
        if (collection !== "全部" && doc.collection !== collection) return false;
        if (level !== "全部" && LEVEL[doc.sensitivity] !== level) return false;
        if (line !== "全部" && !inCategory(doc, line)) return false;
        if (project !== "全部" && !inCategory(doc, project)) return false;
        if (kind !== "全部" && documentType(doc) !== kind) return false;
        const blob = `${doc.title} ${doc.collection} ${doc.owner} ${doc.content}`.toLowerCase();
        if (tag && !blob.includes(tag.toLowerCase())) return false;
        return blob.includes(query.trim().toLowerCase());
      }),
    [docs, trash, canRestricted, collection, query, line, project, level, kind, tag],
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const pagePicked = pageRows.length > 0 && pageRows.every((doc) => picked.includes(doc.id));
  const selected = picked.filter((id) => rows.some((doc) => doc.id === id));
  const cards = [
    {
      name: "产品研发知识库",
      desc: "覆盖产品规划、需求文档、技术方案与迭代记录。",
      level: "全员可读",
      tone: "blue",
    },
    {
      name: "客户支持知识库",
      desc: "FAQ、工单处理话术、售后流程与典型案例。",
      level: "内部",
      tone: "purple",
    },
    {
      name: "内部规章制度",
      desc: "人事、财务、信息安全与合规相关政策文件。",
      level: "内部",
      tone: "green",
    },
  ];
  function openDoc(doc: KbDoc, next: "view" | "edit" | "share") {
    setActive(doc);
    setDialog(next);
    setEditTitle(doc.title);
    setEditBody(doc.content);
    setEditCollection(doc.collection);
    setEditLevel(doc.sensitivity);
  }
  function toggle(id: string) {
    setPicked((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]));
  }
  function resetFilters() {
    setCollection("全部");
    setQuery("");
    setLine("全部");
    setProject("全部");
    setLevel("全部");
    setKind("全部");
    setTag("");
    setTrash(false);
  }
  return (
    <div className="library-page">
      <div className="head-row">
        <div>
          <h1 className="page-h">知识管理</h1>
          <p className="page-sub">知识库、文档、分类与版本管理</p>
        </div>
        <button type="button" className="btn library-create" onClick={() => setCreating(true)}>
          <LibraryIcon name="plus" />
          新建知识库
        </button>
      </div>
      <div className="library-layout">
        <aside className="library-sidebar">
          <section className="library-navigation card" aria-label="分类导航">
            <h2>
              <LibraryIcon name="folder" />
              分类导航
            </h2>
            <FilterGroup
              title="业务线"
              value={line}
              onChange={setLine}
              options={LINES.map((o) => ({
                ...o,
                count: liveDocs.filter((d) => inCategory(d, o.name)).length,
              }))}
            />
            <FilterGroup
              title="项目"
              value={project}
              onChange={setProject}
              options={PROJECTS.map((o) => ({
                ...o,
                count: liveDocs.filter((d) => inCategory(d, o.name)).length,
              }))}
            />
            <FilterGroup
              title="密级"
              value={level}
              onChange={setLevel}
              options={[
                { name: "公开", icon: "public" },
                { name: "内部", icon: "internal" },
                { name: "机密", icon: "restricted" },
              ].map((o) => ({
                ...o,
                count: liveDocs.filter((d) => LEVEL[d.sensitivity] === o.name).length,
              }))}
            />
            <FilterGroup
              title="文档类型"
              value={kind}
              onChange={setKind}
              options={KINDS.map((o) => ({
                ...o,
                count: liveDocs.filter((d) => documentType(d) === o.name).length,
              }))}
            />
          </section>
          <section className="library-popular card">
            <h2>
              <LibraryIcon name="tags" />
              热门标签
            </h2>
            <div className="library-tags">
              {TAGS.map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={tag === item}
                  data-source-tone={
                    ["API 文档", "运维手册", "大模型"].includes(item) ? "blue" : "neutral"
                  }
                  className={tag === item ? "selected" : ""}
                  onClick={() => setTag(tag === item ? "" : item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </section>
          <details className="library-local-tools">
            <summary>本地筛选与演示工具</summary>
            <input
              className="field"
              placeholder="搜索标题"
              aria-label="搜索标题"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button type="button" className="btn ghost" onClick={resetFilters}>
              清除筛选
            </button>
            <button type="button" className="btn ghost" onClick={() => restoreSeed()}>
              恢复示例
            </button>
            <p>本地知识库</p>
            {names.map((name) => (
              <button
                key={name}
                type="button"
                aria-pressed={collection === name}
                onClick={() => setCollection(collection === name ? "全部" : name)}
              >
                {name}
                <span>{liveDocs.filter((d) => d.collection === name).length}</span>
              </button>
            ))}
            {collections.length > 0 ? <p>已创建：{collections.join("、")}</p> : null}
            <p>
              分类按已有分类路径匹配，计数仅含有权限的本地文档。热门标签暂按文本检索，不代表已存储标签。
            </p>
          </details>
        </aside>
        <div className="library-content">
          <section className="library-collections">
            <div className="library-collection-heading">
              <h2>知识库列表</h2>
              <button type="button" onClick={resetFilters}>
                查看全部
              </button>
            </div>
            <div className="library-cover-grid">
              {cards.map((card) => (
                <article key={card.name} className="library-cover-card" data-tone={card.tone}>
                  <div className="library-cover" aria-hidden="true">
                    <LibraryIcon name={`cover-${card.tone}`} size={40} />
                  </div>
                  <div className="library-cover-body">
                    <div className="library-cover-heading">
                      <h3>{card.name}</h3>
                      <span
                        className={`library-level ${card.tone === "blue" ? "public" : "internal"}`}
                      >
                        {card.level}
                      </span>
                    </div>
                    <p>{card.desc}</p>
                    <div className="library-cover-meta">
                      <span>
                        <LibraryIcon name="documents" size={14} />
                        {liveDocs.filter((d) => d.collection === card.name).length} 文档
                      </span>
                      <span title="未记录原始文件大小，无法统计容量">
                        <LibraryIcon name="storage" size={14} />—
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
          <section className="library-documents card">
            <div className="library-doc-head">
              <h2>文档管理</h2>
              <div className="library-view-tabs">
                {(["列表", "卡片"] as const).map((item) => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={view === item}
                    className={view === item ? "on" : ""}
                    onClick={() => setView(item)}
                  >
                    <LibraryIcon name={item === "列表" ? "list" : "grid"} />
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="library-toolbar">
              <label className="library-pick-all">
                <input
                  type="checkbox"
                  aria-label="全选本页文档"
                  checked={pagePicked}
                  onChange={() =>
                    setPicked((old) =>
                      pagePicked
                        ? old.filter((id) => !pageRows.some((d) => d.id === id))
                        : [...new Set([...old, ...pageRows.map((d) => d.id)])],
                    )
                  }
                />
                全选
              </label>
              <span className="library-picked-count">已选 {selected.length} 项</span>
              <div className="library-bulk-actions">
                <button type="button" disabled title="移动服务未接入，仅复刻入口">
                  <LibraryIcon name="move" size={14} />
                  移动
                </button>
                <button
                  type="button"
                  className="danger"
                  disabled={!selected.length || trash}
                  onClick={() => {
                    trashDocs(selected);
                    setPicked([]);
                  }}
                >
                  <LibraryIcon name="delete" size={14} />
                  删除
                </button>
                {trash ? (
                  <button
                    type="button"
                    disabled={!selected.length}
                    onClick={() => {
                      restoreDocs(selected);
                      setPicked([]);
                    }}
                  >
                    恢复
                  </button>
                ) : null}
                <button type="button" disabled title="批量标签尚未实现，仅复刻入口">
                  <LibraryIcon name="tag" size={14} />
                  打标签
                </button>
                <button
                  type="button"
                  disabled
                  title="批量改分类尚未实现，可通过单个文档编辑修改分类"
                >
                  <LibraryIcon name="classify" size={14} />
                  改分类
                </button>
                <button type="button" disabled title="导出服务未接入，仅复刻入口">
                  <LibraryIcon name="export" size={14} />
                  导出
                </button>
              </div>
            </div>
            {view === "列表" ? (
              <div className="library-table-scroll">
                <table className="table library-table">
                  <colgroup>
                    {[45, 195, 99, 75, 119, 152, 117, 150].map((width, index) => (
                      <col key={index} style={{ width: `${(width / 952) * 100}%` }} />
                    ))}
                  </colgroup>
                  <thead>
                    <tr>
                      <th>
                        <span className="sr-only">选择</span>
                      </th>
                      <th>标题</th>
                      <th>类型</th>
                      <th>大小</th>
                      <th>标签</th>
                      <th>分类</th>
                      <th>更新时间</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((doc) => {
                      const type = documentType(doc);
                      const icon =
                        (
                          {
                            PDF: "file-pdf",
                            Word: "file-word",
                            Markdown: "file-markdown",
                            网页: "file-web",
                          } as Record<string, string>
                        )[type] || "documents";
                      return (
                        <tr key={doc.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={picked.includes(doc.id)}
                              onChange={() => toggle(doc.id)}
                              aria-label={`选择 ${doc.title}`}
                            />
                          </td>
                          <td>
                            <span className="library-doc-title">
                              <LibraryIcon name={icon} size={16} />
                              <span>{doc.title}</span>
                            </span>
                          </td>
                          <td>{type}</td>
                          <td title="未记录原始文件大小">—</td>
                          <td title="未记录独立标签元数据">—</td>
                          <td>{doc.collection}</td>
                          <td>{doc.updatedAt.slice(0, 10)}</td>
                          <td>
                            <div className="library-doc-actions">
                              <button
                                type="button"
                                aria-label="查看"
                                title="查看"
                                onClick={() => openDoc(doc, "view")}
                              >
                                <LibraryIcon name="view" />
                              </button>
                              {doc.status !== "trashed" ? (
                                <>
                                  <button
                                    type="button"
                                    aria-label="分享"
                                    title="分享"
                                    onClick={() => openDoc(doc, "share")}
                                  >
                                    <LibraryIcon name="share" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label="编辑"
                                    title="编辑"
                                    onClick={() => openDoc(doc, "edit")}
                                  >
                                    <LibraryIcon name="edit" />
                                  </button>
                                  <button
                                    type="button"
                                    aria-label="删除"
                                    title="删除"
                                    onClick={() => removeDoc(doc.id)}
                                  >
                                    <LibraryIcon name="delete" />
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {!rows.length ? <p className="library-empty">没有文档。</p> : null}
              </div>
            ) : (
              <div className="library-document-cards">
                {pageRows.map((doc) => (
                  <button key={doc.id} type="button" onClick={() => openDoc(doc, "view")}>
                    <strong>{doc.title}</strong>
                    <span>
                      {doc.collection} · {LEVEL[doc.sensitivity]}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <nav className="library-pagination" aria-label="文档分页">
              <span>
                共 {rows.length} 条，第 {currentPage}/{pageCount} 页
              </span>
              <div>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => {
                    setPage(currentPage - 1);
                  }}
                >
                  上一页
                </button>
                <span className="library-current-page" aria-current="page">
                  {currentPage}
                </span>
                <button
                  type="button"
                  disabled={currentPage === pageCount}
                  onClick={() => {
                    setPage(currentPage + 1);
                  }}
                >
                  下一页
                </button>
              </div>
            </nav>
          </section>
          <div className="library-bottom-actions">
            <button
              type="button"
              aria-label={trash ? "返回文档" : "回收站"}
              onClick={() => setTrash(!trash)}
            >
              <span className="library-tile-icon">
                <LibraryIcon name="trash" size={24} />
              </span>
              <span>
                <strong>{trash ? "返回文档" : "回收站"}</strong>
                <small>查看已删除文档，支持恢复与彻底清理</small>
              </span>
              <LibraryIcon name="chevron-right" size={20} />
            </button>
            <button type="button" disabled aria-label="版本管理" title="版本服务未接入，仅复刻入口">
              <span className="library-tile-icon">
                <LibraryIcon name="history" size={24} />
              </span>
              <span>
                <strong>版本管理</strong>
                <small>追溯文档历史版本，支持对比与回滚</small>
              </span>
              <LibraryIcon name="chevron-right" size={20} />
            </button>
          </div>
          <p className="library-boundary">
            移动、导出、版本管理及批量标签/分类仅复刻入口，尚未实现。当前仅保存本地文本，未记录原始容量或独立标签；卡片显示有权限的同名本地文档数。分享仅支持本地推荐摘要。
          </p>
        </div>
      </div>
      {creating ? (
        <div className="overlay" onClick={() => setCreating(false)}>
          <form
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (!kbName.trim()) return;
              addCollection(kbName.trim());
              setKbName("");
              setCreating(false);
            }}
          >
            <h2 className="text-lg font-semibold">新建知识库</h2>
            <input
              className="field mt-3"
              value={kbName}
              onChange={(e) => setKbName(e.target.value)}
              placeholder="知识库名称"
            />
            <div className="mt-4 flex gap-2">
              <button className="btn" type="submit">
                创建
              </button>
              <button className="btn ghost" type="button" onClick={() => setCreating(false)}>
                取消
              </button>
            </div>
          </form>
        </div>
      ) : null}

      <ShareDocumentDialog
        doc={active}
        open={dialog === "share" && Boolean(active)}
        onOpenChange={(open) => {
          if (!open) setDialog(null);
        }}
      />

      {active && dialog && dialog !== "share" ? (
        <div className="overlay" onClick={() => setDialog(null)}>
          <form
            className="modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              if (dialog === "edit") {
                updateDoc(active.id, {
                  title: editTitle,
                  content: editBody,
                  collection: editCollection,
                  sensitivity: editLevel,
                });
              }
              setDialog(null);
            }}
          >
            <h2 className="text-lg font-semibold">
              {dialog === "edit" ? "编辑文档" : active.title}
            </h2>
            <p className="page-sub">
              {active.collection} · {LEVEL[active.sensitivity]} · {active.owner}
            </p>
            {dialog === "edit" ? (
              <>
                <label className="mt-3 block text-sm">
                  标题
                  <input
                    className="field mt-1"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                  />
                </label>
                <label className="mt-3 block text-sm">
                  分类
                  <input
                    className="field mt-1"
                    value={editCollection}
                    onChange={(e) => setEditCollection(e.target.value)}
                  />
                </label>
                <label className="mt-3 block text-sm">
                  密级
                  <select
                    className="select mt-1"
                    value={editLevel}
                    onChange={(e) => setEditLevel(e.target.value as KbDoc["sensitivity"])}
                  >
                    <option value="public">公开</option>
                    <option value="internal">内部</option>
                    <option value="restricted">机密</option>
                  </select>
                </label>
                <textarea
                  className="area mt-3"
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                />
              </>
            ) : (
              <p className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap text-sm leading-6">
                {active.content}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              {dialog === "edit" && active.status !== "trashed" ? (
                <button className="btn" type="submit">
                  保存
                </button>
              ) : null}
              <button className="btn ghost" type="button" onClick={() => setDialog(null)}>
                关闭
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function FilterGroup({
  title,
  value,
  onChange,
  options,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  options: { name: string; icon: string; count: number }[];
}) {
  return (
    <section className="library-filter-group" aria-label={title}>
      <h3>{title}</h3>
      <div>
        {options.map((item) => (
          <button
            key={item.name}
            type="button"
            aria-label={item.name}
            aria-pressed={value === item.name}
            onClick={() => onChange(value === item.name ? "全部" : item.name)}
          >
            <LibraryIcon name={item.icon} size={14} />
            <span>{item.name}</span>
            <small>{item.count}</small>
          </button>
        ))}
      </div>
    </section>
  );
}
