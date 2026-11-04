import type { Chunk } from "./types";
import { uid } from "@/lib/utils";

export function chunkText(text: string, size: number, overlap: number): Chunk[] {
  const clean = text.replace(/\r/g, "").trim();
  if (!clean) return [];
  const paras = clean
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const merged: string[] = [];
  let buf = "";
  const take = Math.max(120, size);
  const lap = Math.min(Math.max(0, overlap), Math.floor(take / 2));

  const pushHard = (block: string) => {
    if (block.length <= take * 1.3) {
      merged.push(block);
      return;
    }
    for (let i = 0; i < block.length; i += take - lap) {
      merged.push(block.slice(i, i + take));
    }
  };

  for (const p of paras) {
    const next = buf ? `${buf}\n${p}` : p;
    if (next.length > take && buf) {
      pushHard(buf);
      const tail = buf.slice(Math.max(0, buf.length - lap));
      buf = `${tail}\n${p}`.trim();
    } else {
      buf = next;
    }
  }
  if (buf) pushHard(buf);

  return merged
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, index) => ({ id: uid("ck"), text, index }));
}

export function tokenize(text: string): string[] {
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z0-9]{2,}/g) ?? [];
  const cjk = lower.replace(/[^\u4e00-\u9fff]/g, "");
  const grams: string[] = [];
  for (let i = 0; i < cjk.length - 1; i++) grams.push(cjk.slice(i, i + 2));
  if (cjk.length === 1) grams.push(cjk);
  return [...words, ...grams];
}

const STOP = new Set(["什么", "如何", "怎么", "可以", "我们", "这个", "是否", "一下", "请问"]);

export function scoreChunk(query: string, text: string) {
  const q = tokenize(query).filter((t) => !STOP.has(t));
  if (!q.length) return 0;
  const hay = tokenize(text);
  const freq = new Map<string, number>();
  for (const t of hay) freq.set(t, (freq.get(t) ?? 0) + 1);
  let score = 0;
  const seen = new Set<string>();
  for (const t of q) {
    const n = freq.get(t) ?? 0;
    if (!n) continue;
    score += Math.min(3, n);
    seen.add(t);
  }
  if (text.includes(query.trim()) && query.trim().length >= 2) score += 4;
  return score * (0.65 + seen.size / q.length);
}

export function looksSensitive(text: string) {
  return /身份证|薪资明细|机密|银行卡|\d{17}[\dXx]/.test(text);
}
