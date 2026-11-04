import { createFileRoute } from "@tanstack/react-router";
import { Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { useMemo, useState } from "react";
import { PageTitle, Panel } from "@/components/app-shell";
import { askKnowledge } from "@/lib/kb/ask.functions";
import { toCitations, useKb } from "@/lib/kb/store";
import { useCan } from "@/lib/kb/use-can";
import type { Citation } from "@/lib/kb/types";
import { cn, uid } from "@/lib/utils";

export const Route = createFileRoute("/_app/ask")({
  component: ChatPage,
});

function ChatPage() {
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
  const can = useCan();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [openCite, setOpenCite] = useState<Citation | null>(null);
  const [filter, setFilter] = useState<"all" | "fav">("all");
  const [assistantId, setAssistantId] = useState("");
  const assistant = assistants.find((item) => item.id === assistantId) ?? null;

  const chat = chats.find((c) => c.id === activeChatId) ?? chats[0];
  const list = useMemo(
    () => (filter === "fav" ? chats.filter((c) => c.favorite) : chats),
    [chats, filter],
  );

  async function send() {
    const question = draft.trim();
    if (!question || busy || !chat) return;
    setDraft("");
    setBusy(true);
    const started = performance.now();
    const found = hits(question, 5, assistant?.collection === "全部知识库" ? undefined : assistant?.collection);
    const citations = toCitations(found);
    const userId = uid("m");
    const asstId = uid("m");
    appendMessage(chat.id, {
      id: userId,
      role: "user",
      content: question,
      citations: [],
    });
    appendMessage(chat.id, {
      id: asstId,
      role: "assistant",
      content: "正在依据知识库作答…",
      citations,
      pending: true,
    });
    try {
      const result = await askKnowledge({
        data: {
          question,
          strict,
          contexts: citations.map((c) => ({
            id: c.docId,
            title: c.title,
            excerpt: c.excerpt,
          })),
          style: assistant?.style,
        },
      });
      patchMessage(chat.id, asstId, {
        pending: false,
        content: result.ok
          ? result.text
          : `${result.error}。下面是已召回的原文切片，可先核对来源。`,
      });
      recordTrace({
        kind: "AI 问答",
        collection: assistant?.collection || "全部知识库",
        query: question,
        hits: found.slice(0, 3).map((item) => ({ title: item.doc.title, score: Number(item.score.toFixed(2)) })),
        answer: result.ok ? result.text : result.error,
        ms: Math.round(performance.now() - started),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "问答失败";
      patchMessage(chat.id, asstId, {
        pending: false,
        content: `${message}。已保留召回切片，可先查看原文。`,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageTitle kicker="问答" title="基于知识库的智能问答">
        <p className="text-sm text-muted">
          {can("受限知识") ? "当前角色可召回受限知识" : "当前角色已隐藏受限文档"}
          {assistant ? ` · 助手「${assistant.name}」只查${assistant.collection}` : ""}
        </p>
      </PageTitle>
      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        <Panel className="p-3">
          <button
            type="button"
            onClick={() => newChat()}
            className="mb-3 flex min-h-11 w-full items-center justify-center rounded-md bg-teal text-sm font-medium text-teal-fg"
          >
            新对话
          </button>
          <label className="mb-3 block text-xs text-muted">
            助手
            <select
              value={assistantId}
              onChange={(event) => setAssistantId(event.target.value)}
              className="mt-1 min-h-10 w-full rounded-md border border-line bg-card px-2 text-sm text-ink"
            >
              <option value="">不限定知识库</option>
              {assistants.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <div className="mb-2 grid grid-cols-2 gap-1 text-sm">
            <button
              type="button"
              className={cn("min-h-10 rounded-md", filter === "all" ? "bg-ink text-paper" : "text-muted")}
              onClick={() => setFilter("all")}
            >
              历史
            </button>
            <button
              type="button"
              className={cn("min-h-10 rounded-md", filter === "fav" ? "bg-ink text-paper" : "text-muted")}
              onClick={() => setFilter("fav")}
            >
              收藏
            </button>
          </div>
          <ul className="flex max-h-80 flex-col gap-1 overflow-auto lg:max-h-[32rem]">
            {list.length === 0 ? (
              <li className="px-2 py-6 text-sm text-muted">还没有收藏的会话。</li>
            ) : (
              list.map((item) => (
                <li key={item.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveChat(item.id)}
                    className={cn(
                      "min-h-11 flex-1 truncate rounded-md px-2 text-left text-sm",
                      item.id === chat?.id ? "bg-paper font-medium" : "hover:bg-paper",
                    )}
                  >
                    {item.title}
                  </button>
                  <button
                    type="button"
                    aria-label={item.favorite ? "取消收藏" : "收藏会话"}
                    onClick={() => toggleFavorite(item.id)}
                    className="grid size-11 place-items-center"
                  >
                    <Star
                      className={cn("size-4", item.favorite ? "fill-copper text-copper" : "text-muted")}
                    />
                  </button>
                </li>
              ))
            )}
          </ul>
        </Panel>
        <Panel className="flex min-h-[70vh] flex-col">
          <div className="flex-1 space-y-4 overflow-auto p-4 sm:p-6">
            {chat?.messages.map((message) => (
              <article
                key={message.id}
                className={cn("max-w-3xl", message.role === "user" ? "ml-auto" : "")}
              >
                <p className="mb-1 text-xs text-muted">{message.role === "user" ? "你" : "智识"}</p>
                <div
                  className={cn(
                    "rounded-lg px-4 py-3 text-sm leading-6",
                    message.role === "user" ? "bg-ink text-paper" : "bg-paper",
                  )}
                >
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </div>
                {message.role === "assistant" && message.citations.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {message.citations.map((cite) => (
                      <button
                        key={`${message.id}-${cite.index}`}
                        type="button"
                        onClick={() => setOpenCite(cite)}
                        className="min-h-10 rounded-md border border-line bg-card px-3 text-xs text-ink"
                      >
                        <span className="mr-1 font-medium text-copper">【{cite.index}】</span>
                        {cite.title}
                      </button>
                    ))}
                  </div>
                ) : null}
                {message.role === "assistant" && !message.pending && message.id !== "m_welcome" ? (
                  <div className="mt-2 flex gap-1">
                    <button
                      type="button"
                      aria-label="有用"
                      onClick={() => feedback(chat.id, message.id, "up")}
                      className={cn(
                        "grid size-11 place-items-center rounded-md",
                        message.feedback === "up" ? "bg-ok-bg text-ok" : "text-muted",
                      )}
                    >
                      <ThumbsUp className="size-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="不满意"
                      onClick={() => feedback(chat.id, message.id, "down")}
                      className={cn(
                        "grid size-11 place-items-center rounded-md",
                        message.feedback === "down" ? "bg-warn-bg text-copper" : "text-muted",
                      )}
                    >
                      <ThumbsDown className="size-4" />
                    </button>
                    {message.feedback === "down" ? (
                      <span className="self-center text-xs text-copper">已交给审核</span>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
          <form
            className="border-t border-line p-3 sm:p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label className="sr-only" htmlFor="question">
              输入问题
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <textarea
                id="question"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                placeholder="输入问题，按 Enter 发送..."
                className="min-h-16 flex-1 resize-none rounded-md border border-line bg-card px-3 py-2 text-sm outline-none focus:border-teal"
              />
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                className="min-h-11 rounded-md bg-teal px-5 text-sm font-medium text-teal-fg disabled:opacity-50"
              >
                {busy ? "作答中" : "发送"}
              </button>
            </div>
          </form>
        </Panel>
      </div>
      {openCite ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="关闭来源"
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpenCite(null)}
          />
          <Panel className="relative z-10 m-4 w-full max-w-lg p-5">
            <p className="text-xs tracking-widest text-copper">回答来源 【{openCite.index}】</p>
            <h2 className="mt-1 font-display text-2xl">{openCite.title}</h2>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-ink">{openCite.excerpt}</p>
            <button
              type="button"
              onClick={() => setOpenCite(null)}
              className="mt-4 min-h-11 rounded-md border border-line px-4 text-sm"
            >
              关闭
            </button>
          </Panel>
        </div>
      ) : null}
    </div>
  );
}
