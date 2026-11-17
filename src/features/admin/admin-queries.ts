import { infiniteQueryOptions, queryOptions, skipToken } from "@tanstack/react-query";
import { shortKeys } from "@/features/abyss/abyss-queries";
import { postKeys } from "@/features/posts/post-queries";
import { getOperatorAdminStatus, listGalleryProposals, listReports, type ReportTargetType } from "@/lib/api/admin";
import { getGalleryBans, getGalleryManagers, getGalleryModerationLogs } from "@/lib/api/community";
import { queryScope } from "@/lib/query";

export const adminKeys = {
  all: (userId: number | null) => [...queryScope(userId), "admin"] as const,
  /** Whether the account is an operator admin (`GET /admin/me`). */
  operator: (userId: number | null) => [...adminKeys.all(userId), "operator"] as const,
  pendingProposals: (userId: number | null) =>
    [...adminKeys.all(userId), "proposals", "PENDING"] as const,
  pendingReports: (userId: number | null) =>
    [...adminKeys.all(userId), "reports", "PENDING"] as const,
  /** Galleries the account may manage; `usePagedItems(["admin", "manageable-galleries"], …)` owns this key. */
  manageableGalleries: (userId: number | null) =>
    [...adminKeys.all(userId), "manageable-galleries"] as const,
  /** Moderation data of one gallery: its bans, its log and its community admins. */
  gallery: (userId: number | null, galleryId: number) =>
    [...adminKeys.all(userId), "gallery", galleryId] as const,
  bans: (userId: number | null, galleryId: number) =>
    [...adminKeys.gallery(userId, galleryId), "bans"] as const,
  logs: (userId: number | null, galleryId: number) =>
    [...adminKeys.gallery(userId, galleryId), "logs"] as const,
  managers: (userId: number | null, galleryId: number) =>
    [...adminKeys.gallery(userId, galleryId), "managers"] as const,
};

export const operatorStatusQuery = (userId: number | null) =>
  queryOptions({
    queryKey: adminKeys.operator(userId),
    queryFn: userId === null ? skipToken : ({ signal }) => getOperatorAdminStatus(signal),
  });

export const galleryManagersQuery = (userId: number | null, galleryId: number) =>
  queryOptions({
    queryKey: adminKeys.managers(userId, galleryId),
    queryFn: ({ signal }) => getGalleryManagers(galleryId, signal),
  });

export type CursorPage<T> = { items: T[]; nextCursor: number | null; hasNext: boolean };

/** A list that follows the server's `nextCursor` on demand. */
function cursorListQuery<T>(
  queryKey: readonly unknown[],
  load: (cursor: number | null, signal: AbortSignal) => Promise<CursorPage<T>>,
) {
  return infiniteQueryOptions({
    queryKey,
    queryFn: ({ pageParam, signal }) => load(pageParam, signal),
    initialPageParam: null as number | null,
    getNextPageParam: (last) => (last.hasNext ? last.nextCursor : null),
  });
}

export const pendingProposalsQuery = (userId: number | null) =>
  cursorListQuery(adminKeys.pendingProposals(userId), (cursor, signal) =>
    listGalleryProposals("PENDING", cursor, signal).then((page) => ({
      ...page,
      items: page.proposals,
    })),
  );

export const pendingReportsQuery = (userId: number | null) =>
  cursorListQuery(adminKeys.pendingReports(userId), (cursor, signal) =>
    listReports("PENDING", cursor, signal).then((page) => ({ ...page, items: page.content })),
  );

export const galleryBansQuery = (userId: number | null, galleryId: number) =>
  cursorListQuery(adminKeys.bans(userId, galleryId), (cursor) =>
    getGalleryBans(galleryId, cursor).then((page) => ({ ...page, items: page.bans })),
  );

export const moderationLogsQuery = (userId: number | null, galleryId: number) =>
  cursorListQuery(adminKeys.logs(userId, galleryId), (cursor) =>
    getGalleryModerationLogs(galleryId, cursor).then((page) => ({ ...page, items: page.logs })),
  );

/** Cached content that deleting a reported target changes. Comment keys are per post/short, so all comments are reread. */
export function reportedContentKey(userId: number | null, targetType: ReportTargetType) {
  if (targetType === "POST") return postKeys.all(userId);
  if (targetType === "SHORT") return shortKeys.all(userId);
  return [...queryScope(userId), "comments"] as const;
}
