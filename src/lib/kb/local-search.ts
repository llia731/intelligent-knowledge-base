import { canReadDoc } from "./query";
import { scoreChunk } from "./chunk";
import type { AccessRole, Perm } from "./access";
import type { KbDoc } from "./types";

export type SearchAccess = {
  accessRole: AccessRole;
  acl: Record<string, AccessRole[]>;
  grants: Record<AccessRole, Perm[]>;
};
export type LocalSearchFilters = {
  scopes: string[] | null;
  types: string[];
  category: string;
  start: string;
  end: string;
  author: string;
  levels: KbDoc["sensitivity"][];
};
export type LocalDocumentHit = { doc: KbDoc; text: string; keywordScore: number };
export function localDocumentType(doc: KbDoc) {
  const ext = doc.title.split(".").pop()?.toLowerCase() || "";
  if (["csv", "xls", "xlsx"].includes(ext)) return "表格";
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "图标";
  return "文档";
}
export function localCategories(doc: KbDoc) {
  return doc.collection
    .split(/\s*\/\s*/)
    .slice(1)
    .filter(Boolean);
}
export function unsupportedSyntax(query: string) {
  return /\b(?:title|tag|author|date)\s*:/i.test(query) || /\b(?:AND|OR|NOT)\b/.test(query);
}
/** Local string matching only: one best stored snippet per authorized indexed document. */
export function searchLocalDocuments(
  docs: KbDoc[],
  query: string,
  access: SearchAccess,
  f: LocalSearchFilters,
): LocalDocumentHit[] {
  if (!query.trim() || unsupportedSyntax(query) || (f.start && f.end && f.start > f.end)) return [];
  const found: LocalDocumentHit[] = [];
  for (const doc of docs) {
    if (doc.status !== "indexed" || !canReadDoc(doc, access)) continue;
    if (f.scopes !== null && !f.scopes.includes(doc.collection)) continue;
    if (!f.types.includes(localDocumentType(doc)) || !f.levels.includes(doc.sensitivity)) continue;
    if (f.category && !localCategories(doc).includes(f.category)) continue;
    if (f.author && !doc.owner.toLowerCase().includes(f.author.trim().toLowerCase())) continue;
    const date = Number.isFinite(Date.parse(doc.updatedAt)) ? doc.updatedAt.slice(0, 10) : "";
    if ((f.start && (!date || date < f.start)) || (f.end && (!date || date > f.end))) continue;
    let best: LocalDocumentHit | undefined;
    for (const text of doc.chunks.length ? doc.chunks.map((chunk) => chunk.text) : [doc.content]) {
      const keywordScore = scoreChunk(query, `${doc.title}\n${text}`);
      if (keywordScore > 0 && (!best || keywordScore > best.keywordScore))
        best = { doc, text, keywordScore };
    }
    if (best) found.push(best);
  }
  return found.sort((a, b) => b.keywordScore - a.keywordScore || a.doc.id.localeCompare(b.doc.id));
}
