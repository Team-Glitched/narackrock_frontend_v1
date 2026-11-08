import { getComposition } from "@/lib/api/composition";
import { usePagedItems } from "@/hooks/use-paged-items";
import { useWorkspace, type Work } from "./workspace-store";
import { workingMusic } from "./working-music";

/** A visit is only a pointer; stale browser snapshots never authorize or render a server project. */
export function useVisitedWorks({ home = false, enabled = true } = {}) {
  const { works: visits } = useWorkspace();
  const load = async (start: number, signal: AbortSignal) => {
    let offset = start;
    const items: { work: Work | null; error: string | null }[] = [];
    do {
      const batch = visits.slice(offset, offset + (home ? 3 : 6));
      const results = await Promise.allSettled(batch.map((visit) => getComposition(visit.id, signal)));
      signal.throwIfAborted();
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
  };
  // Under the composition domain, so writes that invalidate compositions also reread the visited projects.
  const { state, more } = usePagedItems(["composition", "visited", home, visits], 0, load, enabled && visits.length > 0);
  return {
    works: state?.items.flatMap(({ work }) => work ? [work] : []) ?? [],
    error: state?.items.find(({ error }) => error)?.error ?? null,
    loading: enabled && visits.length > 0 && !state,
    appending: state?.busy ?? false,
    hasMore: state != null && state.next !== null,
    more,
  };
}
