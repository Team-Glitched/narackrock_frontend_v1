import { useMemo, useSyncExternalStore } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { parseSignature, validSignature, type TimeSignature } from "./time-signature";
const listeners = new Set<() => void>();
const memory = new Map<string, string>();
const emit = () => listeners.forEach((listener) => listener());
function subscribe(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key) memory.delete(event.key);
    else memory.clear();
    listener();
  };
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
function read(key: string) {
  try {
    return memory.get(key) ?? localStorage.getItem(key) ?? "4/4";
  } catch {
    return memory.get(key) ?? "4/4";
  }
}
export function useTimeSignature(projectId: number | null) {
  const userId = useCurrentUserId();
  const key = `narackrock.time-signature.live.${userId ?? "guest"}.${projectId ?? "none"}`;
  const text = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => "4/4",
  );
  const signature = useMemo(() => parseSignature(text), [text]);
  function setSignature(value: TimeSignature) {
    if (!validSignature(value)) return;
    const next = `${value.numerator}/${value.denominator}`;
    memory.set(key, next);
    try {
      localStorage.setItem(key, next);
    } catch {
      /* Keep the editor usable when browser storage is unavailable. */
    }
    emit();
  }
  return { signature, setSignature };
}
