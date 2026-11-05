import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ApiKey,
  Assistant,
  AuditEntry,
  ChatMessage,
  Citation,
  Conversation,
  DemoUser,
  KbDoc,
  KbSettings,
  ResourceLink,
  ReviewItem,
  Role,
  Sensitivity,
  Trace,
} from "./types";
import { SEED_DOCS, SEED_KEYS, SEED_LOGS, SEED_REVIEWS, SEED_USERS } from "./seed";
import { chunkText, looksSensitive } from "./chunk";
import { rankHits } from "./query";
import { ACCESS_ROLES, DEFAULT_GRANTS, type AccessRole, type Perm } from "./access";
import { uid } from "@/lib/utils";

type KbState = {
  role: Role;
  accessRole: AccessRole;
  grants: Record<AccessRole, Perm[]>;
  acl: Record<string, AccessRole[]>;
  settings: KbSettings;
  connections: ResourceLink[];
  assistants: Assistant[];
  collections: string[];
  traces: Trace[];
  profile: { name: string; dept: string };
  docs: KbDoc[];
  chats: Conversation[];
  activeChatId: string;
  reviews: ReviewItem[];
  logs: AuditEntry[];
  users: DemoUser[];
  keys: ApiKey[];
  freshSecret: string;
  searches: number;
  asks: number;
  setRole: (role: Role) => void;
  setAccessRole: (role: AccessRole) => void;
  setGrants: (role: AccessRole, perms: Perm[]) => void;
  setAcl: (collection: string, roles: AccessRole[]) => void;
  can: (perm: string) => boolean;
  addAssistant: (input: { name: string; collection: string; style: string }) => void;
  addCollection: (name: string) => void;
  addUser: (input: { name: string; email: string; dept: string }) => void;
  saveProfile: (profile: { name: string; dept: string }) => void;
  recordTrace: (input: Omit<Trace, "id" | "at" | "actor">) => void;
  trashDocs: (ids: string[]) => void;
  restoreDocs: (ids: string[]) => void;
  setActiveChat: (id: string) => void;
  newChat: () => string;
  toggleFavorite: (id: string) => void;
  appendMessage: (chatId: string, message: ChatMessage) => void;
  patchMessage: (chatId: string, messageId: string, patch: Partial<ChatMessage>) => void;
  feedback: (chatId: string, messageId: string, value: "up" | "down") => void;
  addDocument: (input: {
    title: string;
    collection: string;
    content: string;
    sensitivity: Sensitivity;
  }) => { doc: KbDoc; review: boolean };
  removeDoc: (id: string) => void;
  updateDoc: (id: string, patch: { title: string; content: string; collection: string; sensitivity: Sensitivity }) => void;
  shareDoc: (id: string, note: string) => void;
  saveSettings: (settings: KbSettings) => void;
  saveConnections: (connections: ResourceLink[]) => void;
  restoreSeed: () => void;
  toggleUser: (id: string) => void;
  resolveReview: (id: string, pass: boolean) => void;
  createKey: (name: string, scopes: string[]) => string;
  revokeKey: (id: string) => void;
  dismissSecret: () => void;
  bumpSearch: () => void;
  hits: (query: string, limit?: number, collection?: string) => { doc: KbDoc; text: string; score: number }[];
};

function actor(get: () => { profile: { name: string }; accessRole: AccessRole }) {
  const { profile, accessRole } = get();
  return profile.name.trim() || accessRole;
}

function log(actorName: string, action: string, target: string, result: string): AuditEntry {
  return {
    id: uid("log"),
    actor: actorName,
    action,
    target,
    result,
    createdAt: new Date().toISOString(),
  };
}

function welcomeChat(): Conversation {
  return {
    id: "chat_welcome",
    title: "新对话",
    favorite: false,
    createdAt: new Date().toISOString(),
    messages: [
      {
        id: "m_welcome",
        role: "assistant",
        content:
          "我是智识，基于已授权知识库作答。可以问年假天数、报销入口、转正材料或设备报修。回答会带上来源，生成内容仅供参考。",
        citations: [],
      },
    ],
  };
}

export const DEFAULT_CONNECTIONS: ResourceLink[] = [
  {
    id: "gen",
    kind: "生成模型",
    label: "默认生成通道",
    endpoint: "",
    identifier: "",
    secretRef: "",
    extra: "超时 30s",
  },
  {
    id: "embed",
    kind: "嵌入模型",
    label: "默认嵌入通道",
    endpoint: "",
    identifier: "",
    secretRef: "",
    extra: "向量维度 1024",
  },
  {
    id: "vector",
    kind: "向量数据库",
    label: "默认向量库",
    endpoint: "",
    identifier: "",
    secretRef: "",
    extra: "集合 kb_default",
  },
];

const initialChat = welcomeChat();

export const useKb = create<KbState>()(
  persist(
    (set, get) => ({
      role: "admin",
      accessRole: "系统管理员",
      grants: DEFAULT_GRANTS,
      acl: {},
      settings: { chunkSize: 280, overlap: 40, strict: true },
      connections: DEFAULT_CONNECTIONS,
      assistants: [],
      collections: [],
      traces: [],
      profile: { name: "当前用户", dept: "产品部" },
      docs: SEED_DOCS,
      chats: [initialChat],
      activeChatId: initialChat.id,
      reviews: SEED_REVIEWS,
      logs: SEED_LOGS,
      users: SEED_USERS,
      keys: SEED_KEYS,
      freshSecret: "",
      searches: 18,
      asks: 42,
      setRole: (role) =>
        set((s) => ({
          role,
          accessRole: role === "admin" ? "系统管理员" : "普通用户",
          logs: [log(actor(get), "切换视角", role === "admin" ? "系统管理员" : "普通用户", "成功"), ...s.logs],
        })),
      setAccessRole: (accessRole) => {
        if (get().accessRole === accessRole) return;
        set((s) => ({
          accessRole,
          role: accessRole === "普通用户" ? "user" : "admin",
          logs: [log(s.profile.name || accessRole, "切换角色", accessRole, "成功"), ...s.logs],
        }));
      },
      setGrants: (accessRole, perms) =>
        set((s) => ({
          grants: { ...s.grants, [accessRole]: perms },
          logs: [log(actor(get), "调整角色权限", accessRole, perms.join("、") || "无权限"), ...s.logs],
        })),
      setAcl: (collection, roles) =>
        set((s) => ({
          acl: { ...s.acl, [collection]: roles },
          logs: [log(actor(get), "调整知识库权限", collection, roles.join("、") || "不限"), ...s.logs],
        })),
      can: (perm) => {
        const { accessRole, grants } = get();
        return (grants[accessRole] ?? []).includes(perm as Perm);
      },
      addAssistant: (input) =>
        set((s) => ({
          assistants: [
            { id: uid("ast"), name: input.name.trim() || "未命名助手", collection: input.collection, style: input.style },
            ...s.assistants,
          ],
          logs: [log(actor(get), "创建助手", input.name, input.collection), ...s.logs],
        })),
      addCollection: (name) => {
        const title = name.trim();
        if (!title) return;
        set((s) => ({
          collections: s.collections.includes(title) ? s.collections : [title, ...s.collections],
          logs: [log(actor(get), "新建知识库", title, "已登记"), ...s.logs],
        }));
      },
      addUser: (input) =>
        set((s) => ({
          users: [
            {
              id: uid("user"),
              name: input.name.trim(),
              email: input.email.trim() || `${input.name.trim()}@zhishi.co`,
              dept: input.dept.trim() || "未分配",
              roleLabel: "普通用户",
              enabled: true,
              lastLogin: "刚刚",
            },
            ...s.users,
          ],
          logs: [log(actor(get), "新增用户", input.name, "启用"), ...s.logs],
        })),
      saveProfile: (profile) =>
        set((s) => ({
          profile,
          logs: [log(profile.name || "当前用户", "更新个人资料", profile.dept, "成功"), ...s.logs],
        })),
      recordTrace: (input) =>
        set((s) => ({
          traces: [{ ...input, id: uid("tr"), at: new Date().toISOString(), actor: actor(get) }, ...s.traces].slice(0, 80),
          logs: [
            log(actor(get), input.kind, input.query.slice(0, 40), input.hits.length ? `召回 ${input.hits.length}` : "零结果"),
            ...s.logs,
          ],
        })),
      setActiveChat: (id) => set({ activeChatId: id }),
      newChat: () => {
        const chat = welcomeChat();
        chat.id = uid("chat");
        chat.messages = [{ ...chat.messages[0], id: uid("m") }];
        set((s) => ({ chats: [chat, ...s.chats], activeChatId: chat.id }));
        return chat.id;
      },
      toggleFavorite: (id) =>
        set((s) => ({
          chats: s.chats.map((c) => (c.id === id ? { ...c, favorite: !c.favorite } : c)),
        })),
      appendMessage: (chatId, message) =>
        set((s) => ({
          asks: message.role === "user" ? s.asks + 1 : s.asks,
          chats: s.chats.map((c) => {
            if (c.id !== chatId) return c;
            const title =
              c.title === "新对话" && message.role === "user"
                ? message.content.slice(0, 18)
                : c.title;
            return { ...c, title, messages: [...c.messages, message] };
          }),
        })),
      patchMessage: (chatId, messageId, patch) =>
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id !== chatId
              ? c
              : {
                  ...c,
                  messages: c.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)),
                },
          ),
        })),
      feedback: (chatId, messageId, value) => {
        const chat = get().chats.find((c) => c.id === chatId);
        const message = chat?.messages.find((m) => m.id === messageId);
        if (!message || message.feedback === value) return;
        set((s) => ({
          chats: s.chats.map((c) =>
            c.id !== chatId
              ? c
              : {
                  ...c,
                  messages: c.messages.map((m) => (m.id === messageId ? { ...m, feedback: value } : m)),
                },
          ),
          reviews:
            value === "down"
              ? [
                  {
                    id: uid("rv"),
                    title: chat?.title ?? "问答反馈",
                    reason: `用户标记回答不满意：${message.content.slice(0, 80)}`,
                    status: "open" as const,
                    createdAt: new Date().toISOString(),
                  },
                  ...s.reviews,
                ]
              : s.reviews,
          logs: [
            log(actor(get), value === "up" ? "标记有用" : "标记不满意", chat?.title ?? chatId, "已记录"),
            ...s.logs,
          ],
        }));
      },
      addDocument: (input) => {
                const { settings } = get();
        const sensitive = input.sensitivity === "restricted" || looksSensitive(input.content);
        const doc: KbDoc = {
          id: uid("doc"),
          title: input.title.trim() || "未命名文档",
          collection: input.collection,
          content: input.content.trim(),
          status: sensitive ? "pending" : "indexed",
          sensitivity: input.sensitivity,
          owner: actor(get),
          updatedAt: new Date().toISOString(),
          chunks: sensitive ? [] : chunkText(input.content, settings.chunkSize, settings.overlap),
          shareNote: "",
        };
        set((s) => ({
          docs: [doc, ...s.docs],
          reviews: sensitive
            ? [
                {
                  id: uid("rv"),
                  title: doc.title,
                  reason: "命中敏感信息或受限密级，等待人工复核",
                  status: "open",
                  createdAt: new Date().toISOString(),
                  docId: doc.id,
                },
                ...s.reviews,
              ]
            : s.reviews,
          logs: [
            log(actor(get), sensitive ? "拦截上传" : "索引文档", doc.title, sensitive ? "待审核" : "成功"),
            ...s.logs,
          ],
        }));
        return { doc, review: sensitive };
      },
      removeDoc: (id) => {
        const title = get().docs.find((d) => d.id === id)?.title ?? id;
        set((s) => ({
          docs: s.docs.map((d) => (d.id === id ? { ...d, status: "trashed" } : d)),
          logs: [log(actor(get), "删除文档", title, "进入回收站"), ...s.logs],
        }));
      },
      updateDoc: (id, patch) => {
        const { settings } = get();
        const title = patch.title.trim() || "未命名文档";
        const content = patch.content.trim();
        set((s) => ({
          docs: s.docs.map((d) => {
            if (d.id !== id || d.status === "trashed") return d;
            const sensitive = patch.sensitivity === "restricted" || looksSensitive(content);
            return {
              ...d,
              title,
              content,
              collection: patch.collection,
              sensitivity: patch.sensitivity,
              status: sensitive ? "pending" : "indexed",
              updatedAt: new Date().toISOString(),
              chunks: sensitive ? [] : chunkText(content, settings.chunkSize, settings.overlap),
            };
          }),
          logs: [log(actor(get), "编辑文档", title, "已保存到本地知识库"), ...s.logs],
        }));
      },
      trashDocs: (ids) => {
        const titles = get()
          .docs.filter((d) => ids.includes(d.id))
          .map((d) => d.title)
          .join("、");
        set((s) => ({
          docs: s.docs.map((d) => (ids.includes(d.id) ? { ...d, status: "trashed" } : d)),
          logs: [log(actor(get), "删除文档", titles || "批量", "进入回收站"), ...s.logs],
        }));
      },
      restoreDocs: (ids) => {
        set((s) => ({
          docs: s.docs.map((d) => {
            if (!ids.includes(d.id) || d.status !== "trashed") return d;
            return { ...d, status: d.chunks.length > 0 ? "indexed" : "pending" };
          }),
          logs: [log(actor(get), "恢复文档", String(ids.length), "已回到索引"), ...s.logs],
        }));
      },
      shareDoc: (id, note) => {
                set((s) => ({
          docs: s.docs.map((d) => (d.id === id ? { ...d, shareNote: note } : d)),
          logs: [log(actor(get), "分享文档", get().docs.find((d) => d.id === id)?.title ?? id, "已记录附言"), ...s.logs],
        }));
      },
      saveSettings: (settings) => {
                set((s) => ({
          settings,
          docs: s.docs.map((d) =>
            d.status === "indexed"
              ? { ...d, chunks: chunkText(d.content, settings.chunkSize, settings.overlap) }
              : d,
          ),
          logs: [log(actor(get), "更新分块策略", `${settings.chunkSize}/${settings.overlap}`, "已重新索引"), ...s.logs],
        }));
      },
      saveConnections: (connections) => {
                set((s) => ({
          connections,
          logs: [log(actor(get), "保存连接配置", connections.map((item) => item.kind).join("、"), "未发起连接"), ...s.logs],
        }));
      },
      restoreSeed: () =>
        set((s) => ({
          docs: SEED_DOCS,
          reviews: SEED_REVIEWS,
          logs: [log(actor(get), "恢复示例知识", "内置制度", "成功"), ...s.logs],
        })),
      toggleUser: (id) => {
                const user = get().users.find((u) => u.id === id);
        set((s) => ({
          users: s.users.map((u) => (u.id === id ? { ...u, enabled: !u.enabled } : u)),
          logs: [log(actor(get), user?.enabled ? "禁用用户" : "启用用户", user?.name ?? id, "成功"), ...s.logs],
        }));
      },
      resolveReview: (id, pass) => {
                const item = get().reviews.find((r) => r.id === id);
        const settings = get().settings;
        set((s) => ({
          reviews: s.reviews.map((r) =>
            r.id === id ? { ...r, status: pass ? "passed" : "rejected" } : r,
          ),
          docs: s.docs.map((d) => {
            if (!item?.docId || d.id !== item.docId) return d;
            if (!pass) return { ...d, status: "rejected", chunks: [] };
            return {
              ...d,
              status: "indexed",
              chunks: chunkText(d.content, settings.chunkSize, settings.overlap),
            };
          }),
          logs: [
            log(actor(get), pass ? "通过审核" : "驳回审核", item?.title ?? id, pass ? "已索引" : "已驳回"),
            ...s.logs,
          ],
        }));
      },
      createKey: (name, scopes) => {
                const secret = `zsk_live_${uid("sec").replace(/[^a-z0-9]/gi, "")}${Math.random().toString(36).slice(2, 10)}`;
        const key: ApiKey = {
          id: uid("key"),
          name: name.trim() || "未命名密钥",
          scopes,
          createdAt: new Date().toISOString().slice(0, 10),
          calls: 0,
          secretPreview: `zsk_live_····${secret.slice(-4)}`,
        };
        set((s) => ({
          keys: [key, ...s.keys],
          freshSecret: secret,
          logs: [log(actor(get), "创建密钥", key.name, "仅展示一次"), ...s.logs],
        }));
        return secret;
      },
      revokeKey: (id) => {
        const key = get().keys.find((item) => item.id === id);
        set((s) => ({
          keys: s.keys.filter((item) => item.id !== id),
          logs: [log(actor(get), "撤销密钥", key?.name ?? id, "成功"), ...s.logs],
        }));
      },
      dismissSecret: () => set({ freshSecret: "" }),
      bumpSearch: () => set((s) => ({ searches: s.searches + 1 })),
      hits: (query, limit = 6, collection) => {
        const { docs, accessRole, acl, grants } = get();
        return rankHits(docs, query, { accessRole, acl, grants }, limit, collection);
      },
    }),
    {
      name: "zhishi-kb-v1",
      skipHydration: true,
      // Raw one-time demo tokens must never be stored in browser localStorage.
      partialize: (state) => ({ ...state, freshSecret: "" }),
      onRehydrateStorage: () => (state, error) => {
        // Re-write the sanitized state so legacy tokens also leave storage,
        // rather than only disappearing from the in-memory merged state.
        if (!error && state) state.dismissSecret();
      },
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<KbState>;
        return {
          ...current,
          ...saved,
          // Also clear secrets written by older persisted store versions.
          freshSecret: "",
          connections: saved.connections && saved.connections.length > 0 ? saved.connections : current.connections,
          grants: saved.grants ?? current.grants,
          accessRole: saved.accessRole ?? current.accessRole,
          assistants: saved.assistants ?? [],
          collections: saved.collections ?? [],
          traces: saved.traces ?? [],
          profile: saved.profile ?? current.profile,
          acl: saved.acl ?? {},
          can: current.can,
        };
      },
    },
  ),
);

export function toCitations(hits: { doc: KbDoc; text: string; score: number }[]): Citation[] {
  return hits.map((h, i) => ({
    docId: h.doc.id,
    title: h.doc.title,
    excerpt: h.text,
    index: i + 1,
  }));
}
