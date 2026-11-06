import {
  infiniteQueryOptions,
  queryOptions,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";
import type { ShortItemDto, ShortsPageDto } from "@/lib/api/contracts";
import {
  getShort,
  getShortComposers,
  getShortParticipantTracks,
  getShorts,
} from "@/lib/api/shorts";
import { queryScope } from "@/lib/query";

export const shortKeys = {
  all: (userId: number | null) => [...queryScope(userId), "shorts"] as const,
  feed: (userId: number | null) => [...shortKeys.all(userId), "feed"] as const,
  detail: (userId: number | null, shortId: number) =>
    [...shortKeys.all(userId), "detail", shortId] as const,
  composers: (userId: number | null, shortId: number) =>
    [...shortKeys.all(userId), "composers", shortId] as const,
  participantTracks: (userId: number | null, shortId: number) =>
    [...shortKeys.all(userId), "participant-tracks", shortId] as const,
};

/**
 * Abyss feed. Refetching a cursor feed while the screen is open would shift the short under the listener, so it never
 * refetches on focus/reconnect; entering the screen again after the cache went stale loads the current feed (as the
 * screen did before), and an explicit retry or invalidation reloads it. An empty page ends the feed.
 */
export const shortsFeedQuery = (userId: number | null) =>
  infiniteQueryOptions({
    queryKey: shortKeys.feed(userId),
    queryFn: ({ pageParam, signal }) => getShorts(pageParam, signal),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (last) =>
      last.items.length > 0 && last.page.hasMore && last.page.nextCursor != null
        ? last.page.nextCursor
        : undefined,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

export const shortDetailQuery = (userId: number | null, shortId: number) =>
  queryOptions({
    queryKey: shortKeys.detail(userId, shortId),
    queryFn: ({ signal }) => getShort(shortId, signal),
  });

export const shortComposersQuery = (userId: number | null, shortId: number) =>
  queryOptions({
    queryKey: shortKeys.composers(userId, shortId),
    queryFn: ({ signal }) => getShortComposers(shortId, signal),
  });

/**
 * Approved tracks/clips of a short's participants; requires a session. Kept for the whole session: a background
 * refetch would rebuild the composition under a playing owner subset.
 */
export const shortParticipantTracksQuery = (userId: number | null, shortId: number) =>
  queryOptions({
    queryKey: shortKeys.participantTracks(userId, shortId),
    queryFn: ({ signal }) => getShortParticipantTracks(shortId, signal),
    staleTime: Infinity,
  });

/** Applies a server-confirmed change of one short to the feed and its detail entry. */
export function updateCachedShort(
  client: QueryClient,
  userId: number | null,
  shortId: number,
  update: (short: ShortItemDto) => ShortItemDto,
) {
  client.setQueryData<InfiniteData<ShortsPageDto, number | undefined>>(
    shortKeys.feed(userId),
    (feed) =>
      feed && {
        ...feed,
        pages: feed.pages.map((page) => ({
          ...page,
          items: page.items.map((item) => (item.shortId === shortId ? update(item) : item)),
        })),
      },
  );
  client.setQueryData<ShortItemDto>(
    shortKeys.detail(userId, shortId),
    (short) => short && update(short),
  );
}
