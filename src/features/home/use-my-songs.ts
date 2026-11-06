import { useInfiniteQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import type { ShortItemDto } from "@/lib/api/contracts";
import { appendUniqueSongs } from "./my-songs";
import { mySongsQuery } from "./home-queries";

export function useMySongs(size = 20, enabled = true) {
  const userId = useCurrentUserId();
  const active = userId !== null && enabled;
  const query = useInfiniteQuery({ ...mySongsQuery(userId, size), enabled: active });
  const items = query.data?.pages.reduce<ShortItemDto[]>((all, page) => appendUniqueSongs(all, page.items), []) ?? [];
  const firstPageFailed = query.isError && !query.data;
  const errorMessage = query.error instanceof Error ? query.error.message : null;
  return {
    status: !active ? "signed-out" as const : query.data ? "ready" as const : firstPageFailed ? "error" as const : "loading" as const,
    items,
    hasMore: query.hasNextPage,
    appending: query.isFetchingNextPage,
    error: firstPageFailed
      ? errorMessage ?? "음악 목록을 불러오지 못했습니다."
      : query.isFetchNextPageError ? errorMessage ?? "다음 목록을 불러오지 못했습니다." : null,
    loadMore: () => {
      if (!query.isFetching && query.hasNextPage) void query.fetchNextPage();
    },
    retry: () => void query.refetch(),
  };
}
