import type { InfiniteData, QueryClient } from "@tanstack/react-query";
import { apiOrigin, getCurrentUserId } from "@/lib/api/client";
import { pagedItemsKey } from "@/hooks/use-paged-items";
import { forgetMissingWorkVisits, type WorkVisit, type WorkspaceScope } from "./workspace-store";
import type { loadVisitedWorksPage } from "./visited-works";

type VisitedPages = InfiniteData<Awaited<ReturnType<typeof loadVisitedWorksPage>>, number>;

/** Carry loaded pages to the cleaned history's key before notifying workspace subscribers. */
export function cleanupMissingVisitedWorks(
  client: QueryClient,
  visits: readonly WorkVisit[],
  missing: readonly WorkVisit[],
  scope: WorkspaceScope,
  home: boolean,
) {
  if (scope.origin !== apiOrigin() || scope.userId !== getCurrentUserId()) return;
  const snapshots = new Map(missing.map((visit) => [visit.id, visit.updatedAt]));
  const isMissing = (visit: WorkVisit) => snapshots.has(visit.id) && snapshots.get(visit.id) === visit.updatedAt;
  const remaining = visits.filter((visit) => !isMissing(visit));
  if (remaining.length === visits.length) return;

  const key = (history: readonly WorkVisit[]) =>
    pagedItemsKey(scope.userId, ["composition", "visited", home, history]);
  const currentKey = key(visits);
  const data = client.getQueryData<VisitedPages>(currentKey);
  if (data) {
    const cursorAfterCleanup = (cursor: number) => cursor - visits.slice(0, cursor).filter(isMissing).length;
    const cleaned: VisitedPages = { pages: [], pageParams: [] };
    data.pages.forEach((page, index) => {
      const items = page.items.filter(({ missingVisit }) => !missingVisit || !isMissing(missingVisit));
      const next = page.next === null ? null : cursorAfterCleanup(page.next);
      if (items.length) {
        cleaned.pages.push({ items, next });
        cleaned.pageParams.push(cursorAfterCleanup(data.pageParams[index]));
      } else {
        // Empty pages can collapse onto an already requested cursor, which would end pagination early.
        const previous = cleaned.pages.at(-1);
        if (previous) previous.next = next;
      }
    });
    // If every loaded page disappeared, let the new history start at its first remaining visit.
    if (cleaned.pages.length) {
      client.setQueryData<VisitedPages>(key(remaining), cleaned,
        { updatedAt: client.getQueryState(currentKey)?.dataUpdatedAt });
    }
  }
  forgetMissingWorkVisits(missing, scope);
}
