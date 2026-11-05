import { createFileRoute } from "@tanstack/react-router";
import { Copy, Plus, Sparkles, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { useEffect, useState } from "react";
import { askKnowledge, getChatModels } from "@/lib/kb/ask.functions";
import { toCitations, useKb } from "@/lib/kb/store";
import type { Citation } from "@/lib/kb/types";
import { uid } from "@/lib/utils";

export const Route = createFileRoute("/_app/ask")({ component: AskPage });

const SUGGEST = ["公司年假多少天", "如何申请报销", "试用期转正流程", "会议室怎么预定"];
const HISTORY_SAMPLE = ["如何申请报销", "年假政策说明", "IT 设备报修流程", "试用期转正需要准备什么"];

function AskPage() {
  const chats = useKb((s) => s.chats);
  const activeChatId = useKb((s) => s.activeChatId);
  const setActiveChat = useKb((s) => s.setActiveChat);
  const newChat = useKb((s) => s.newChat);
  const toggleFavorite = useKb((s) => s.toggleFavorite);
  const appendMessage = useKb((s) => s.appendMessage);
  const patchMessage = useKb((s) => s.patchMessage);
  const feedback = useKb((s) => s.feedback);
  const hits = useKb((s) => s.hits);
  const strict = useKb((s) => s.settings.strict);
  const assistants = useKb((s) => s.assistants);
  const recordTrace = useKb((s) => s.recordTrace);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"all" | "fav">("all");
  const [assistantId, setAssistantId] = useState("");
  const [modelId, setModelId] = useState("");
  const [chatModels, setChatModels] = useState<{ id: string; label: string }[]>([]);
  const [modelStatus, setModelStatus] = useState("正在获取内网模型…");
  const [openCite, setOpenCite] = useState<Citation | null>(null);
  const [showSample, setShowSample] = useState(true);

  useEffect(() => {
    let active = true;
    getChatModels()
      .then(({ models }) => {
        if (!active) return;
        setChatModels(models);
        setModelId((previous) => (models.some((model) => model.id === previous) ? previous : models[0]?.id ?? ""));
        setModelStatus(models.length ? "" : "当前没有已配置且被网关列出的生成模型");
      })
      .catch(() => {
        if (!active) return;
        setChatModels([]);
        setModelId("");
        setModelStatus("模型列表获取失败，请检查内网服务");
      });
    return () => {
      active = false;
    };
  }, []);

  const assistant = assistants.find((item) => item.id === assistantId) ?? null;
  const chat = chats.find((item) => item.id === activeChatId) ?? chats[0];
  const visible = chats.filter((item) => (filter === "fav" ? item.favorite : true));
  const userMessages = chat?.messages.filter((item) => item.role === "user") ?? [];

  async function send(text?: string) {
    const question = (text ?? draft).trim();
    if (!question || busy || !chat || !modelId) return;
    setShowSample(false);
    setDraft("");
    setBusy(true);
    const started = performance.now();
    const collection = assistant && assistant.collection !== "全部知识库" ? assistant.collection : undefined;
    const found = hits(question, 5, collection);
    const citations = toCitations(found);
    appendMessage(chat.id, { id: uid("m"), role: "user", content: question, citations: [] });
    const pendingId = uid("m");
    appendMessage(chat.id, {
      id: pendingId,
      role: "assistant",
      content: "正在依据知识库作答…",
      citations,
      pending: true,
    });
    try {
      const result = await askKnowledge({
        data: {
          question,
          modelId,
          strict,
          style: assistant?.style,
          contexts: citations.map((item) => ({ id: item.docId, title: item.title, excerpt: item.excerpt })),
        },
      });
      patchMessage(chat.id, pendingId, {
        pending: false,
        content: result.ok ? result.text : result.error,
      });
      recordTrace({
        kind: "AI 问答",
        collection: collection ?? "全部知识库",
        query: question,
        hits: found.slice(0, 5).map((item) => ({ title: item.doc.title, score: item.score })),
        answer: result.ok ? result.text : result.error,
        ms: Math.round(performance.now() - started),
      });
    } catch (error) {
      patchMessage(chat.id, pendingId, {
        pending: false,
        content: error instanceof Error ? error.message : "问答失败",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1 className="page-h">AI 问答</h1>
      <p className="page-sub">基于知识库内容的自然语言智能问答</p>
      <div className="mt-4 grid gap-4 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="card flex flex-col p-3">
          <button type="button" className="btn w-full" onClick={() => { newChat(); setShowSample(true); }}>
            <Plus size={14} />新对话
          </button>
          <p className="mt-4 px-1 text-xs font-semibold text-[var(--m-sub)]">历史会话</p>
          <div className="mt-2 space-y-1">
            {HISTORY_SAMPLE.map((item) => (
              <button key={item} type="button" className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--m-paper)]" onClick={() => { setDraft(item); setShowSample(true); }}>
                {item}
              </button>
            ))}
            {visible.filter((item) => item.title !== "新对话").map((item) => (
              <button key={item.id} type="button" className="flex w-full items-center gap-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-[var(--m-paper)]" onClick={() => { setActiveChat(item.id); setShowSample(false); }}>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="icon-btn" onClick={(event) => { event.stopPropagation(); toggleFavorite(item.id); }} aria-label="收藏">
                  <Star size={14} className={item.favorite ? "fill-amber-400 text-amber-500" : ""} />
                </span>
              </button>
            ))}
          </div>
          <button type="button" className="mt-3 text-left text-xs text-[var(--m-blue)]" onClick={() => setFilter(filter === "fav" ? "all" : "fav")}>
            {filter === "fav" ? "查看全部会话" : "收藏会话"}
          </button>
          <p className="mt-3 px-1 text-xs font-semibold text-[var(--m-sub)]">收藏会话</p>
          <div className="mt-1 space-y-1 text-sm text-amber-600">
            <p>入职指引合集</p>
            <p>财务报销百问百答</p>
          </div>
          <label className="mt-4 block text-xs text-[var(--m-sub)]">AI 助手
            <select className="select mt-1" value={assistantId} onChange={(e) => setAssistantId(e.target.value)} aria-label="选择助手">
              <option value="">不限定知识库</option>
              {assistants.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
        </aside>

        <section className="card flex min-h-[640px] flex-col p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-medium"><Sparkles size={16} className="text-[var(--m-blue)]" />AI 助手</h2>
            <label className="flex items-center gap-2 text-xs text-[var(--m-sub)]">
              模型
              <select
                aria-label="选择内网生成模型"
                className="select"
                style={{ width: 180 }}
                value={modelId}
                disabled={busy || chatModels.length === 0}
                onChange={(event) => setModelId(event.target.value)}
              >
                {chatModels.length === 0 ? <option value="">暂无可用模型</option> : null}
                {chatModels.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
              </select>
            </label>
          </div>
          {modelStatus ? <p role="status" className="note mb-2">{modelStatus}。不会使用原型里的 GPT-4 等演示名称。</p> : null}

          <div className="flex-1 space-y-4 overflow-auto">
            {showSample && userMessages.length === 0 ? (
              <div>
                <div className="py-6 text-center">
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--m-blue-soft)] text-[var(--m-blue)]"><Sparkles /></span>
                  <p className="mt-3 text-xl font-semibold">我是你的 AI 知识助手</p>
                  <p className="text-sm text-[var(--m-sub)]">基于企业知识库，为你提供可信、可溯源的问答服务。</p>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    {SUGGEST.map((item) => (
                      <button key={item} type="button" className="chip" onClick={() => void send(item)}>{item}</button>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end"><span className="rounded-2xl bg-[var(--m-blue)] px-3 py-2 text-sm text-white">公司年假多少天？</span></div>
                <div className="mt-3 rounded-2xl bg-[var(--m-paper)] p-4 text-sm leading-7">
                  <p>根据《员工手册》第 3.2 条规定，公司员工年假标准如下：</p>
                  <ul className="mt-1 list-disc pl-5">
                    <li>入职满 1 年不满 10 年：每年 <b>5 天</b></li>
                    <li>入职满 10 年不满 20 年：每年 <b>10 天</b></li>
                    <li>入职满 20 年及以上：每年 <b>15 天</b></li>
                  </ul>
                  <p className="mt-2">年假需在当年 12 月 31 日前休完，可累计至次年的上限为 2 天。如有疑问，可联系 HR 确认个人工龄折算。</p>
                  <pre className="mt-3 overflow-auto rounded-lg bg-white p-3 text-xs text-[var(--m-sub)]">{`// 示例：查询剩余年假\nGET /api/leave/balance?type=annual`}</pre>
                  <p className="mt-3 text-xs">可信度 <span className="tag green">高</span> <span className="note ml-2">以上为原型示例排版，不是本次模型调用。</span></p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button type="button" className="rounded-xl border border-[var(--m-line)] bg-white px-3 py-2 text-left text-sm" onClick={() => setOpenCite({ docId: "sample", title: "员工手册 2024.pdf", excerpt: "第 3.2 条 年假标准", index: 1 })}>
                      员工手册 2024.pdf <span className="note">P.12 · 相似度 96%</span>
                    </button>
                    <button type="button" className="rounded-xl border border-[var(--m-line)] bg-white px-3 py-2 text-left text-sm" onClick={() => setOpenCite({ docId: "sample2", title: "HR 政策 FAQ.docx", excerpt: "年假累计说明", index: 2 })}>
                      HR 政策 FAQ.docx <span className="note">P.4 · 相似度 88%</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {chat?.messages.filter((item) => item.id !== "m_welcome").map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : ""}>
                <div className={message.role === "user" ? "max-w-[80%] rounded-2xl bg-[var(--m-blue)] px-3 py-2 text-sm text-white" : "max-w-[92%] rounded-2xl bg-[var(--m-paper)] p-4 text-sm leading-7"}>
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  {message.role === "assistant" && !message.pending ? (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" className="icon-btn" aria-label="有用" onClick={() => feedback(chat.id, message.id, "up")}><ThumbsUp size={14} /></button>
                      <button type="button" className="icon-btn" aria-label="不满意" onClick={() => feedback(chat.id, message.id, "down")}><ThumbsDown size={14} /></button>
                      <button type="button" className="icon-btn" aria-label="复制" onClick={() => void navigator.clipboard?.writeText(message.content)}><Copy size={14} /></button>
                      {message.citations.map((cite) => (
                        <button key={cite.docId + cite.index} type="button" className="chip" onClick={() => setOpenCite(cite)}>
                          [{cite.index}] {cite.title}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          <form className="mt-3 flex items-center gap-2" onSubmit={(event) => { event.preventDefault(); void send(); }}>
            <input
              className="field"
              placeholder={modelId ? "输入问题，按 Enter 发送" : "暂无可用模型，无法发送"}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              disabled={!modelId}
            />
            <button className="btn" type="submit" disabled={busy || !draft.trim() || !modelId}>{busy ? "作答中" : "发送"}</button>
          </form>
        </section>
      </div>

      {openCite ? (
        <div className="overlay" onClick={() => setOpenCite(null)}>
          <div className="modal" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-lg font-semibold">{openCite.title}</h2>
            <p className="mt-2 text-sm leading-6">{openCite.excerpt}</p>
            <p className="note mt-2">{openCite.docId.startsWith("sample") ? "原型示例引用，不是知识库切片。" : "来自当前召回的本地切片。"}</p>
            <button type="button" className="btn mt-4" onClick={() => setOpenCite(null)}>关闭</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
