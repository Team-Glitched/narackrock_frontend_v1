import { queryOptions } from "@tanstack/react-query";
import { getLikedPostIds } from "@/lib/api/community";
import { getProfile } from "@/lib/api/profile";
import { getRelations } from "@/lib/api/social";
import { queryScope } from "@/lib/query";

export const profileKeys = {
  all: (userId: number | null) => [...queryScope(userId), "profiles"] as const,
  detail: (userId: number | null, targetId: number) =>
    [...profileKeys.all(userId), "detail", targetId] as const,
  relations: (userId: number | null, targetId: number, kind: "followers" | "following") =>
    [...profileKeys.all(userId), "relations", targetId, kind] as const,
  likedPostIds: (userId: number | null) => [...profileKeys.all(userId), "liked-post-ids"] as const,
};

export const profileQuery = (userId: number | null, targetId: number) =>
  queryOptions({
    queryKey: profileKeys.detail(userId, targetId),
    queryFn: ({ signal }) => getProfile(targetId, signal),
  });

/** Rejects with 403 for another user's private profile. */
export const relationsQuery = (
  userId: number | null,
  targetId: number,
  kind: "followers" | "following",
) =>
  queryOptions({
    queryKey: profileKeys.relations(userId, targetId, kind),
    queryFn: ({ signal }) => getRelations(targetId, kind, signal),
  });

/** Liked post IDs of the signed-in user, deduplicated in server order. */
export const likedPostIdsQuery = (userId: number | null) =>
  queryOptions({
    queryKey: profileKeys.likedPostIds(userId),
    queryFn: async ({ signal }) => [...new Set(await getLikedPostIds(signal))],
  });
