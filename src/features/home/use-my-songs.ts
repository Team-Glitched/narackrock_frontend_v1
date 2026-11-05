import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { apiOrigin } from "@/lib/api/client";
import { getMyShorts } from "@/lib/api/shorts";
import type { ShortItemDto } from "@/lib/api/contracts";

import { appendUniqueSongs } from "./my-songs";

type State = {
  scope: string;
  status: "loading" | "ready" | "error";
  items: ShortItemDto[];
  cursor: number | null;
  hasMore: boolean;
  appending: boolean;
  error: string | null;
};
export function useMySongs(size = 20, enabled = true) {
  const userId = useCurrentUserId();
  const origin = apiOrigin();
  const scope = JSON.stringify([origin, userId, size, enabled]);
  const [revision, setRevision] = useState(0);
  const [state, setState] = useState<State | null>(null);
  const active = useRef<{ scope: string; controller: AbortController; busy: boolean } | null>(null);

  useEffect(() => {
    if (userId === null || !enabled) return;
    const request = { scope, controller: new AbortController(), busy: true };
    active.current = request;
    setState({ scope, status: "loading", items: [], cursor: null, hasMore: false, appending: false, error: null });
    getMyShorts({ size }, request.controller.signal).then((page) => {
      if (active.current !== request || request.controller.signal.aborted) return;
      setState({ scope, status: "ready", items: appendUniqueSongs([], page.items), cursor: page.page.nextCursor,
        hasMore: page.page.hasMore, appending: false, error: null });
    }).catch((cause: unknown) => {
      if (active.current !== request || request.controller.signal.aborted) return;
      setState({ scope, status: "error", items: [], cursor: null, hasMore: false, appending: false,
        error: cause instanceof Error ? cause.message : "음악 목록을 불러오지 못했습니다." });
    }).finally(() => { request.busy = false; });
    return () => { request.controller.abort(); if (active.current === request) active.current = null; };
  }, [scope, revision, userId, size, enabled]);

  const loadMore = useCallback(() => {
    const request = active.current;
    if (!request || request.scope !== scope || request.busy || state?.scope !== scope ||
      state.status !== "ready" || !state.hasMore || state.cursor === null) return;
    request.busy = true;
    setState((current) => current?.scope === scope ? { ...current, appending: true, error: null } : current);
    getMyShorts({ size, cursor: state.cursor }, request.controller.signal).then((page) => {
      if (active.current !== request || request.controller.signal.aborted) return;
      setState((current) => current?.scope === scope ? { ...current,
        items: appendUniqueSongs(current.items, page.items), cursor: page.page.nextCursor,
        hasMore: page.page.hasMore, appending: false, error: null } : current);
    }).catch((cause: unknown) => {
      if (active.current !== request || request.controller.signal.aborted) return;
      setState((current) => current?.scope === scope ? { ...current, appending: false,
        error: cause instanceof Error ? cause.message : "다음 목록을 불러오지 못했습니다." } : current);
    }).finally(() => { request.busy = false; });
  }, [scope, state, size]);

  const visible = state?.scope === scope ? state : null;
  return {
    status: userId === null || !enabled ? "signed-out" as const : visible?.status ?? "loading" as const,
    items: visible?.items ?? [], hasMore: visible?.hasMore ?? false,
    appending: visible?.appending ?? false, error: visible?.error ?? null,
    loadMore, retry: () => setRevision((value) => value + 1),
  };
}
