import { useSyncExternalStore } from "react";

const empty: ReadonlyMap<number, number | null> = new Map();
const cache = new Map<string, { raw: string | null; ids: ReadonlyMap<number, number | null> }>();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
function read(key: string): ReadonlyMap<number, number | null> {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return cache.get(key)?.ids ?? empty;
  }
  const previous = cache.get(key);
  if (previous?.raw === raw) return previous.ids;
  let ids = empty;
  try {
    const parsed: unknown = JSON.parse(raw ?? "[]");
    if (Array.isArray(parsed)) {
      const entries = new Map<number, number | null>();
      for (const entry of parsed) {
        const [id, parentId] = Array.isArray(entry) ? entry : [entry, null];
        if (Number.isSafeInteger(id) && id > 0) {
          entries.set(id, Number.isSafeInteger(parentId) && parentId > 0 ? parentId : null);
        }
      }
      ids = entries;
    }
  } catch {
    /* Ignore malformed browser storage. */
  }
  cache.set(key, { raw, ids });
  return ids;
}

export function useHiddenIds(key: string | null) {
  const ids = useSyncExternalStore(
    key === null ? () => () => {} : subscribe,
    () => key === null ? empty : read(key),
    () => empty,
  );
  function hide(id: number, parentId: number | null = null) {
    if (key === null) return;
    const current = read(key);
    if (current.has(id) && (parentId === null || current.get(id) === parentId)) return;
    const next = new Map(current);
    next.set(id, parentId);
    const raw = JSON.stringify(Array.from(next, ([id, parent]) => parent === null ? id : [id, parent]));
    try {
      localStorage.setItem(key, raw);
      cache.set(key, { raw, ids: next });
    } catch {
      // Keep the action effective during this session even if storage is unavailable.
      cache.set(key, { raw: cache.get(key)?.raw ?? null, ids: next });
    }
    listeners.forEach((listener) => listener());
  }
  return { ids, hide };
}
