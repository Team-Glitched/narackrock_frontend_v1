import {
  readBrowserRecord,
  writeBrowserRecord,
  deleteBrowserRecord,
} from "../../lib/browser/records.ts";
export type SourceMetadata = {
  id: number;
  title: string;
  description: string;
  author: string;
  userId: number;
};
export type SavedSource = SourceMetadata & { mediaKey: string | null; savedAt: string };
const empty: SavedSource[] = [];
const cache = new Map<string, { raw: string | null; items: SavedSource[] }>();
const listeners = new Set<() => void>();
export const subscribeSavedSources = (listener: () => void) => {
  listeners.add(listener);
  if (typeof window !== "undefined") window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", listener);
  };
};
const storageKey = (scope: string) => `narackrock.saved-sources.${scope}`;
export function savedSourcesSnapshot(scope: string): SavedSource[] {
  if (typeof localStorage === "undefined") return empty;
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(scope));
  } catch {
    return cache.get(scope)?.items ?? empty;
  }
  const previous = cache.get(scope);
  if (previous?.raw === raw) return previous.items;
  let items = empty;
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed))
      items = parsed.filter(
        (item): item is SavedSource =>
          Boolean(item) &&
          typeof item.title === "string" &&
          typeof item.description === "string" &&
          typeof item.author === "string" &&
          Number.isSafeInteger(item.id) &&
          Number.isSafeInteger(item.userId) &&
          (item.mediaKey === null || typeof item.mediaKey === "string") &&
          typeof item.savedAt === "string",
      );
  } catch {
    /* Corrupt local data must not break the page. */
  }
  cache.set(scope, { raw, items });
  return items;
}
function save(scope: string, items: SavedSource[]) {
  localStorage.setItem(storageKey(scope), JSON.stringify(items));
  cache.delete(scope);
  listeners.forEach((listener) => listener());
}
export function removeSavedSource(scope: string, id: number) {
  const current = savedSourcesSnapshot(scope),
    source = current.find((item) => item.id === id);
  save(
    scope,
    current.filter((item) => item.id !== id),
  );
  if (source?.mediaKey) void deleteBrowserRecord(source.mediaKey).catch(() => {});
}
export async function toggleSavedSource(scope: string, source: SourceMetadata, file: File | null) {
  if (savedSourcesSnapshot(scope).some((item) => item.id === source.id)) {
    removeSavedSource(scope, source.id);
    return;
  }
  const mediaKey = file ? `${storageKey(scope)}:audio:${source.id}` : null;
  if (mediaKey) await writeBrowserRecord(mediaKey, file);
  // Re-read after the file transaction so concurrent saves do not overwrite each other.
  const current = savedSourcesSnapshot(scope);
  const entry: SavedSource = {
    id: source.id,
    title: source.title,
    description: source.description,
    author: source.author,
    userId: source.userId,
    mediaKey,
    savedAt: new Date().toISOString(),
  };
  try {
    save(scope, [entry, ...current.filter((item) => item.id !== source.id)]);
  } catch (cause) {
    if (mediaKey) void deleteBrowserRecord(mediaKey).catch(() => {});
    throw cause;
  }
}
export const readSavedSourceAudio = (source: SavedSource) =>
  source.mediaKey ? readBrowserRecord<File>(source.mediaKey) : Promise.resolve(undefined);
