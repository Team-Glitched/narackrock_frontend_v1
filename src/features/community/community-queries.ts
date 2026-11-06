import { queryOptions, skipToken } from "@tanstack/react-query";
import { queryScope } from "@/lib/query";
import { fetchGalleries, getMyGalleryProposals, getMyGalleryRole } from "@/lib/api/community";

export const galleryKeys = {
  all: (userId: number | null) => [...queryScope(userId), "galleries"] as const,
  /** `GET /galleries`: every gallery with its subscriber count. */
  list: (userId: number | null) => [...galleryKeys.all(userId), "list"] as const,
  /** IDs of the galleries the signed-in user subscribed to. */
  subscribed: (userId: number | null) => [...galleryKeys.all(userId), "subscribed"] as const,
  /** Mutation key of subscribe/unsubscribe, used to find in-flight membership changes. */
  membership: (userId: number | null) => [...galleryKeys.all(userId), "membership"] as const,
  role: (userId: number | null, galleryId: number | null) =>
    [...galleryKeys.all(userId), "role", galleryId] as const,
  myProposals: (userId: number | null) =>
    [...galleryKeys.all(userId), "proposals", "mine"] as const,
};

/** The whole gallery list; it is not paged and guests may read it. */
export function galleriesQuery(userId: number | null) {
  return queryOptions({
    queryKey: galleryKeys.list(userId),
    queryFn: ({ signal }) => fetchGalleries(signal),
  });
}

/** The signed-in user's role in a gallery (`GET /galleries/{id}/manage/me`); guests have none. */
export function galleryRoleQuery(userId: number | null, galleryId: number | null) {
  return queryOptions({
    queryKey: galleryKeys.role(userId, galleryId),
    queryFn:
      userId === null || galleryId === null
        ? skipToken
        : ({ signal }) => getMyGalleryRole(galleryId, signal),
  });
}

/** The signed-in user's community proposals (`GET /gallery-proposals/me`). */
export function myGalleryProposalsQuery(userId: number | null) {
  return queryOptions({
    queryKey: galleryKeys.myProposals(userId),
    queryFn: userId === null ? skipToken : ({ signal }) => getMyGalleryProposals(signal),
  });
}
