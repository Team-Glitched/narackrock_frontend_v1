import { useEffect } from "react";
import { apiOrigin } from "@/lib/api/client";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { usePagedItems } from "@/hooks/use-paged-items";
import { forgetMissingWorkVisits, useWorkspace } from "./workspace-store";
import { loadVisitedWorksPage } from "./visited-works";

/** A visit is only a pointer; stale browser snapshots never authorize or render a server project. */
export function useVisitedWorks({ home = false, enabled = true } = {}) {
  const { works: visits } = useWorkspace();
  const userId = useCurrentUserId();
  const origin = apiOrigin();
  const load = (start: number, signal: AbortSignal) => loadVisitedWorksPage(visits, start, signal, home);
  // Under the composition domain, so writes that invalidate compositions also reread the visited projects.
  const active = enabled && userId !== null && visits.length > 0;
  const { state, more } = usePagedItems(["composition", "visited", home, visits], 0, load, active);
  useEffect(() => {
    const missing = state?.items.flatMap(({ missingVisit }) => missingVisit ? [missingVisit] : []) ?? [];
    if (missing.length) forgetMissingWorkVisits(missing, { origin, userId });
  }, [state, origin, userId]);
  return {
    works: state?.items.flatMap(({ work }) => work ? [work] : []) ?? [],
    error: state?.items.find(({ error }) => error)?.error ?? null,
    loading: active && !state,
    appending: state?.busy ?? false,
    hasMore: state != null && state.next !== null,
    more,
  };
}
