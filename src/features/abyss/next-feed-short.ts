import type { InfiniteData } from "@tanstack/react-query";
import type { ShortsPageDto } from "@/lib/api/contracts";

type FeedData = InfiniteData<ShortsPageDto>;

export async function findNextFeedShort(
  feed: { data?: FeedData; hasNextPage: boolean },
  fetchNextPage: () => Promise<{ data?: FeedData; hasNextPage: boolean; isFetchNextPageError: boolean }>,
  loadedIds: ReadonlySet<number>,
  signal: AbortSignal,
) {
  let page = feed;
  const visited = new Set(feed.data?.pageParams);
  while (!signal.aborted && page.hasNextPage) {
    const cursor = page.data?.pages.at(-1)?.page.nextCursor;
    if (cursor == null || visited.has(cursor)) return { kind: "failed" } as const;
    visited.add(cursor);

    const result = await fetchNextPage();
    if (signal.aborted) return { kind: "cancelled" } as const;
    if (result.isFetchNextPageError || result.data?.pageParams.at(-1) !== cursor) {
      return { kind: "failed" } as const;
    }

    const short = result.data.pages.at(-1)?.items.find((item) => !loadedIds.has(item.shortId));
    if (short) return { kind: "found", short } as const;
    page = result;
  }
  return { kind: signal.aborted ? "cancelled" : "end" } as const;
}
