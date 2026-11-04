export type Role = "user" | "admin";

export type DocStatus = "indexed" | "pending" | "rejected" | "trashed";

export type Sensitivity = "public" | "internal" | "restricted";

export type Chunk = {
  id: string;
  text: string;
  index: number;
};

export type KbDoc = {
  id: string;
  title: string;
  collection: string;
  content: string;
  status: DocStatus;
  sensitivity: Sensitivity;
  owner: string;
  updatedAt: string;
  chunks: Chunk[];
  shareNote: string;
};

export type Citation = {
  docId: string;
  title: string;
  excerpt: string;
  index: number;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: Citation[];
  pending?: boolean;
  feedback?: "up" | "down";
};

export type Conversation = {
  id: string;
  title: string;
  favorite: boolean;
  createdAt: string;
  messages: ChatMessage[];
};

export type ReviewItem = {
  id: string;
  title: string;
  reason: string;
  status: "open" | "passed" | "rejected";
  createdAt: string;
  docId?: string;
};

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  target: string;
  result: string;
  createdAt: string;
};

export type DemoUser = {
  id: string;
  name: string;
  email: string;
  dept: string;
  roleLabel: string;
  enabled: boolean;
  lastLogin: string;
};

export type ApiKey = {
  id: string;
  name: string;
  scopes: string[];
  createdAt: string;
  calls: number;
  secretPreview: string;
};

export type KbSettings = {
  chunkSize: number;
  overlap: number;
  strict: boolean;
};

/** 尚未真正接通的外部资源，只保留连接配置。 */
export type ResourceLink = {
  id: string;
  kind: string;
  label: string;
  endpoint: string;
  identifier: string;
  secretRef: string;
  extra: string;
};

export type Assistant = {
  id: string;
  name: string;
  collection: string;
  style: string;
};

export type Trace = {
  id: string;
  at: string;
  actor: string;
  kind: "检索查询" | "AI 问答" | "知识上传" | "删除";
  collection: string;
  query: string;
  hits: { title: string; score: number }[];
  answer: string;
  ms: number;
};
