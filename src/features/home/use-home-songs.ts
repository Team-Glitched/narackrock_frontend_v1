import { useEffect, useState } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { getPopularShorts, getShorts } from "@/lib/api/shorts";
import { useMySongs } from "./use-my-songs";
import { recommendByAuthor } from "@/features/community/discovery";
import type { ShortItemDto } from "@/lib/api/contracts";

type SongListState = {
  status: "loading" | "ready" | "error" | "signed-out";
  items: ShortItemDto[];
};

export function useHomeSongs(size = 10) {
  const currentUserId = useCurrentUserId();
  const [popular, setPopular] = useState<SongListState>({ status: "loading", items: [] });
  const [feed, setFeed] = useState<SongListState>({ status: "loading", items: [] });
  const mine = useMySongs(size);

  useEffect(() => {
    const controller = new AbortController();
    getPopularShorts(size, controller.signal)
      .then((page) => setPopular({ status: "ready", items: page.items }))
      .catch(() => {
        if (!controller.signal.aborted) setPopular({ status: "error", items: [] });
      });
    return () => controller.abort();
  }, [size]);

  useEffect(() => {
    const controller = new AbortController();
    getShorts(undefined, controller.signal)
      .then((page) => setFeed({ status: "ready", items: page.items }))
      .catch(() => {
        if (!controller.signal.aborted) setFeed({ status: "error", items: [] });
      });
    return () => controller.abort();
  }, []);


  const recommended = {
    ...feed,
    items: recommendByAuthor(feed.items, (item) => item.author.userId, currentUserId).slice(
      0,
      size,
    ),
  };
  return { popular, mine, recommended };
}
