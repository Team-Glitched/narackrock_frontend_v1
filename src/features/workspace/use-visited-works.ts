import { useCallback } from "react";
import { apiOrigin } from "@/lib/api/client";
import { getComposition } from "@/lib/api/composition";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { usePagedItems } from "@/hooks/use-paged-items";
import { useWorkspace, type Work } from "./workspace-store";
import { workingMusic } from "./working-music";

/** A visit is only a pointer; stale browser snapshots never authorize or render a server project. */
export function useVisitedWorks({ home = false, enabled = true } = {}) {
  const { works: visits } = useWorkspace();
  const userId = useCurrentUserId();
  const scope = JSON.stringify([apiOrigin(), userId, home, visits]);
  const load = useCallback(async (start: number, signal: AbortSignal) => {
    let offset = start;
    const items: { work: Work | null; error: string | null }[] = [];
    do {
      const batch = visits.slice(offset, offset + (home ? 3 : 6));
      const results = await Promise.allSettled(batch.map((visit) => getComposition(visit.id, signal)));
      if (signal.aborted) break;
      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          const composition = result.value;
          items.push({ work: { ...batch[index], title: composition.project.title, composition }, error: null });
        } else {
          items.push({ work: null, error: "일부 작업을 불러오지 못했습니다." });
        }
      });
      offset += batch.length;
    } while (home && offset < visits.length &&
      workingMusic(items.flatMap(({ work }) => work ? [work] : [])).length < 3);

    return { items, next: !home && offset < visits.length ? offset : null };
  }, [home, visits]);
  const { state, more } = usePagedItems(scope, 0, load, enabled && visits.length > 0);
  return {
    works: state?.items.flatMap(({ work }) => work ? [work] : []) ?? [],
    error: state?.items.find(({ error }) => error)?.error ?? null,
    loading: enabled && visits.length > 0 && !state,
    appending: state?.busy ?? false,
    hasMore: state != null && state.next !== null,
    more,
  };
}
