"use client";

import { useEffect, useState } from "react";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { getMyShorts, getPopularShorts } from "@/lib/api/shorts";
import type { ShortItemDto } from "@/lib/api/contracts";

type SongListState = {
  status: "loading" | "ready" | "error" | "signed-out";
  items: ShortItemDto[];
};

type UserSongListState = SongListState & { userId: number };

export function useHomeSongs(size = 10) {
  const currentUserId = useCurrentUserId();
  const [popular, setPopular] = useState<SongListState>({ status: "loading", items: [] });
  const [mineResult, setMineResult] = useState<UserSongListState | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    getPopularShorts(size, controller.signal)
      .then(page => setPopular({ status: "ready", items: page.items }))
      .catch(() => {
        if (!controller.signal.aborted) setPopular({ status: "error", items: [] });
      });
    return () => controller.abort();
  }, [size]);

  useEffect(() => {
    if (currentUserId === null) return;
    const controller = new AbortController();
    getMyShorts(size, controller.signal)
      .then(page => setMineResult({ userId: currentUserId, status: "ready", items: page.items }))
      .catch(() => {
        if (!controller.signal.aborted) setMineResult({ userId: currentUserId, status: "error", items: [] });
      });
    return () => controller.abort();
  }, [currentUserId, size]);

  const mine: SongListState = currentUserId === null
    ? { status: "signed-out", items: [] }
    : mineResult?.userId === currentUserId
      ? mineResult
      : { status: "loading", items: [] };

  return { popular, mine };
}
