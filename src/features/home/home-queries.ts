import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { getMyShorts, getPopularShorts, getShorts } from "@/lib/api/shorts";
import { queryScope } from "@/lib/query";

export const songKeys = {
  all: (userId: number | null) => [...queryScope(userId), "songs"] as const,
  popular: (userId: number | null, size: number) =>
    [...songKeys.all(userId), "popular", size] as const,
  recommended: (userId: number | null) => [...songKeys.all(userId), "recommended"] as const,
  mine: (userId: number | null, size: number) => [...songKeys.all(userId), "mine", size] as const,
};

export const popularSongsQuery = (userId: number | null, size: number) =>
  queryOptions({
    queryKey: songKeys.popular(userId, size),
    queryFn: ({ signal }) => getPopularShorts(size, signal),
  });

/** First page of the shorts feed; the home rail re-ranks it by author. */
export const recommendedSongsQuery = (userId: number | null) =>
  queryOptions({
    queryKey: songKeys.recommended(userId),
    queryFn: ({ signal }) => getShorts(undefined, signal),
  });

/** Authored and participated songs of the signed-in user, one cursor list for both tabs. */
export const mySongsQuery = (userId: number | null, size: number) =>
  infiniteQueryOptions({
    queryKey: songKeys.mine(userId, size),
    queryFn: ({ pageParam, signal }) => getMyShorts({ size, cursor: pageParam }, signal),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) =>
      last.page.hasMore && last.page.nextCursor !== null ? last.page.nextCursor : undefined,
  });
