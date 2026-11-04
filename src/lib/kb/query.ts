import type { AccessRole, Perm } from "./access";
import { scoreChunk } from "./chunk";
import type { KbDoc } from "./types";

type Access = {
  accessRole: AccessRole;
  acl: Record<string, AccessRole[]>;
  grants: Record<AccessRole, Perm[]>;
};

export function canReadDoc(doc: KbDoc, access: Access) {
  const perms = access.grants[access.accessRole] ?? [];
  if (doc.sensitivity === "restricted" && !perms.includes("受限知识")) return false;
  const readers = access.acl[doc.collection] ?? [];
  if (readers.length > 0 && !readers.includes(access.accessRole)) return false;
  return true;
}

export function rankHits(docs: KbDoc[], query: string, access: Access, limit = 6, collection?: string) {
  const ranked: { doc: KbDoc; text: string; score: number }[] = [];
  for (const doc of docs) {
    if (doc.status !== "indexed") continue;
    if (collection && collection !== "全部知识库" && doc.collection !== collection) continue;
    if (!canReadDoc(doc, access)) continue;
    for (const chunk of doc.chunks) {
      const score = scoreChunk(query, `${doc.title}\n${chunk.text}`);
      if (score <= 0) continue;
      ranked.push({ doc, text: chunk.text, score });
    }
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}

export function withheldCount(docs: KbDoc[], query: string, access: Access, collection?: string) {
  return docs.filter((doc) => {
    if (doc.status !== "indexed") return false;
    if (collection && collection !== "全部知识库" && doc.collection !== collection) return false;
    const matched = doc.chunks.some((chunk) => scoreChunk(query, `${doc.title}\n${chunk.text}`) > 0);
    return matched && !canReadDoc(doc, access);
  }).length;
}
