import { useSyncExternalStore } from "react";

const empty: ReadonlySet<number> = new Set();
const cache = new Map<string, { raw: string | null; ids: ReadonlySet<number> }>();
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}
function read(key: string): ReadonlySet<number> {
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
    if (Array.isArray(parsed))
      ids = new Set(parsed.filter((id) => Number.isSafeInteger(id) && id > 0));
  } catch {
    /* Ignore malformed browser storage. */
  }
  cache.set(key, { raw, ids });
  return ids;
}

export function useHiddenIds(key: string) {
  const ids = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => empty,
  );
  function hide(id: number) {
    const current = read(key);
    if (current.has(id)) return;
    const next = new Set([...current, id]);
    const raw = JSON.stringify([...next]);
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
