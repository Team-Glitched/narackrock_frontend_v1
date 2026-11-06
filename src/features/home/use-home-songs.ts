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

export function useHomeSongs(size = 10, kind?: "popular" | "recommended" | "mine") {
  const currentUserId = useCurrentUserId();
  const [popular, setPopular] = useState<SongListState>({ status: "loading", items: [] });
  const [feed, setFeed] = useState<SongListState>({ status: "loading", items: [] });
  const mine = useMySongs(size, !kind || kind === "mine");

  useEffect(() => {
    if (kind && kind !== "popular") return;
    const controller = new AbortController();
    getPopularShorts(size, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setPopular({ status: "ready", items: page.items });
      })
      .catch(() => {
        if (!controller.signal.aborted) setPopular({ status: "error", items: [] });
      });
    return () => controller.abort();
  }, [size, kind]);

  useEffect(() => {
    if (kind && kind !== "recommended") return;
    const controller = new AbortController();
    getShorts(undefined, controller.signal)
      .then((page) => {
        if (!controller.signal.aborted) setFeed({ status: "ready", items: page.items });
      })
      .catch(() => {
        if (!controller.signal.aborted) setFeed({ status: "error", items: [] });
      });
    return () => controller.abort();
  }, [kind]);


  const recommended = {
    ...feed,
    items: recommendByAuthor(feed.items, (item) => item.author.userId, currentUserId).slice(
      0,
      size,
    ),
  };
  return { popular, mine, recommended };
}
