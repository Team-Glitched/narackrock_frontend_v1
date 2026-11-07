import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useMySongs } from "./use-my-songs";
import { popularSongsQuery, recommendedSongsQuery } from "./home-queries";
import { recommendByAuthor } from "@/features/community/discovery";
import type { ShortItemDto } from "@/lib/api/contracts";

type SongListState = {
  status: "loading" | "ready" | "error";
  items: ShortItemDto[];
};

function songList(query: { data?: { items: ShortItemDto[] }; isError: boolean }): SongListState {
  if (query.data) return { status: "ready", items: query.data.items };
  return { status: query.isError ? "error" : "loading", items: [] };
}

export function useHomeSongs(size = 10, kind?: "popular" | "recommended" | "mine") {
  const currentUserId = useCurrentUserId();
  const popular = useQuery({ ...popularSongsQuery(currentUserId, size), enabled: !kind || kind === "popular" });
  const feed = songList(useQuery({ ...recommendedSongsQuery(currentUserId), enabled: !kind || kind === "recommended" }));
  const mine = useMySongs(size, !kind || kind === "mine");

  const recommended = {
    ...feed,
    items: recommendByAuthor(feed.items, (item) => item.author.userId, currentUserId).slice(
      0,
      size,
    ),
  };
  return { popular: songList(popular), mine, recommended };
}
