import { isPreviewMode } from "@/features/preview/preview-mode";
import { useSyncExternalStore } from "react";
import { useCurrentUserId } from "@/hooks/use-current-user";

export type SavedItem = {
  id: number; kind: "post" | "song"; title: string; author: string;
  imageUrl: string | null; savedAt: string;
};
const empty: SavedItem[] = [];
const cache = new Map<string, { raw: string | null; items: SavedItem[] }>();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => { listeners.delete(listener); window.removeEventListener("storage", listener); };
}
function read(key: string) {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { return cache.get(key)?.items ?? empty; }
  const previous = cache.get(key);
  if (previous?.raw === raw) return previous.items;
  let items = empty;
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) items = parsed.filter((item): item is SavedItem =>
      item && Number.isSafeInteger(item.id) && ["post", "song"].includes(item.kind)
      && typeof item.title === "string" && typeof item.author === "string"
      && typeof item.savedAt === "string" && (item.imageUrl === null || typeof item.imageUrl === "string"));
  } catch { /* Ignore malformed browser storage. */ }
  cache.set(key, { raw, items });
  return items;
}
export function useSavedItems() {
  const userId = useCurrentUserId();
  const key = `${isPreviewMode() ? "narackrock.preview.saved" : "narackrock.saved"}.${userId ?? "guest"}`;
  const items = useSyncExternalStore(subscribe, () => read(key), () => empty);
  function toggle(item: Omit<SavedItem, "savedAt">) {
    const current = read(key);
    const exists = current.some(entry => entry.kind === item.kind && entry.id === item.id);
    const next = exists ? current.filter(entry => entry.kind !== item.kind || entry.id !== item.id)
      : [{ ...item, savedAt: new Date().toISOString() }, ...current];
    const raw = JSON.stringify(next);
    try { localStorage.setItem(key, raw); }
    catch { throw new Error("이 브라우저에 저장하지 못했어요. 저장 공간과 브라우저 설정을 확인해 주세요."); }
    cache.set(key, { raw, items: next });
    listeners.forEach(listener => listener());
  }
  return { items, toggle, has: (kind: SavedItem["kind"], id: number) => items.some(item => item.kind === kind && item.id === id) };
}
