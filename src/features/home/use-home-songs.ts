import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { ApiError } from "@/lib/api/client";
import type { RecommendedShortDto, ShortItemDto } from "@/lib/api/contracts";
import { useMySongs } from "./use-my-songs";
import { popularSongsQuery, recommendedSongsQuery } from "./home-queries";
import { appendUniqueSongs } from "./my-songs";

type SongListState<T> = {
  status: "loading" | "ready" | "error";
  items: T[];
};

function songList<T>(query: { data?: { items: T[] }; isError: boolean }): SongListState<T> {
  if (query.data) return { status: "ready", items: query.data.items };
  return { status: query.isError ? "error" : "loading", items: [] };
}

function useRecommendedSongs(userId: number | null, enabled: boolean) {
  const queryClient = useQueryClient();
  const options = recommendedSongsQuery(userId);
  const query = useInfiniteQuery({ ...options, enabled });
  const items = query.data?.pages.reduce<RecommendedShortDto[]>(
    (all, page) => appendUniqueSongs(all, page.items),
    [],
  );
  const expired = query.error instanceof ApiError && query.error.status === 410;
  return {
    ...songList({ data: items && { items }, isError: query.isError }),
    firstPage: query.data?.pages[0]?.items ?? [],
    hasMore: query.hasNextPage,
    appending: query.isFetchingNextPage,
    appendFailed: query.isFetchNextPageError,
    expired,
    loadMore: () => {
      if (query.isFetching) return;
      if (expired) void queryClient.resetQueries({ queryKey: options.queryKey, exact: true });
      else if (query.hasNextPage) void query.fetchNextPage();
    },
    retry: () => void query.refetch(),
  };
}

export function useHomeSongs(size = 10, kind?: "popular" | "recommended") {
  const currentUserId = useCurrentUserId();
  const popular = useQuery({ ...popularSongsQuery(currentUserId, size), enabled: !kind || kind === "popular" });
  const recommended = useRecommendedSongs(currentUserId, !kind || kind === "recommended");
  const mine = useMySongs(size, !kind);
  return { popular: songList<ShortItemDto>(popular), mine, recommended };
}
