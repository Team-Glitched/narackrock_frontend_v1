import { useCallback, useEffect, useRef, useState } from "react";

export type ItemPage<T, Cursor> = { items: T[]; next: Cursor | null };

export function usePagedItems<T, Cursor>(
  scope: string,
  first: Cursor,
  load: (cursor: Cursor, signal: AbortSignal) => Promise<ItemPage<T, Cursor>>,
  enabled = true,
) {
  const [result, setState] = useState<{
    scope: string;
    items: T[];
    next: Cursor | null;
    busy: boolean;
    error: { cause: unknown } | null;
  } | null>(null);
  const session = useRef<{
    scope: string;
    controller: AbortController;
    cursor: Cursor | null;
    busy: boolean;
    seen: Set<Cursor>;
  } | null>(null);
  type Session = NonNullable<typeof session.current>;

  const request = useCallback((current: Session, fetchPage: typeof load, reset = false) => {
    const { controller, cursor } = current;
    if (current.busy || cursor === null || controller.signal.aborted) return;
    current.busy = true;
    setState((old) => !reset && old?.scope === current.scope ? { ...old, busy: true, error: null } : null);
    void fetchPage(cursor, controller.signal).then(({ items, next }) => {
      if (controller.signal.aborted) return;
      current.seen.add(cursor);
      current.cursor = next !== null && !current.seen.has(next) ? next : null;
      setState((old) => ({
        scope: current.scope,
        items: [...(old?.scope === current.scope ? old.items : []), ...items], next: current.cursor, busy: false, error: null,
      }));
    }).catch((cause: unknown) => {
      if (controller.signal.aborted) return;
      setState((old) => ({ scope: current.scope, items: old?.scope === current.scope ? old.items : [], next: cursor, busy: false, error: { cause } }));
    }).finally(() => { current.busy = false; });
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const current: Session = {
      scope, controller: new AbortController(), cursor: first, busy: false, seen: new Set(),
    };
    session.current = current;
    queueMicrotask(() => request(current, load, true));
    return () => {
      session.current?.controller.abort();
      session.current = null;
    };
  }, [enabled, first, load, request, scope]);

  return {
    state: enabled && result?.scope === scope ? result : null,
    more: () => { if (session.current?.scope === scope) request(session.current, load); },
    reload: () => {
      if (session.current?.scope !== scope) return;
      session.current.controller.abort();
      const next: Session = {
        scope, controller: new AbortController(), cursor: first, busy: false, seen: new Set(),
      };
      session.current = next;
      request(next, load, true);
    },
    remove: (predicate: (item: T) => boolean) => {
      setState((old) => old?.scope === scope ? { ...old, items: old.items.filter((item) => !predicate(item)) } : old);
    },
  };
}
