import { COLLECTIONS } from "./seed";

export function collectionNames(
  docs: { collection: string; status?: string }[],
  extra: string[] = [],
  options?: { seed?: boolean; trashed?: boolean },
) {
  const fromDocs = docs
    .filter((doc) => options?.trashed || doc.status !== "trashed")
    .map((doc) => doc.collection);
  const seed = options?.seed === false ? [] : COLLECTIONS;
  return [...new Set([...seed, ...extra, ...fromDocs])];
}
