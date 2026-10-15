"use client";

import { useEffect, useState } from "react";
import { fetchPopularPosts } from "@/lib/api/community";
import type { PopularPostItem } from "@/lib/api/contracts";

type PopularPostsState =
  | { status: "loading" | "error"; posts: PopularPostItem[] }
  | { status: "ready"; posts: PopularPostItem[] };

export function usePopularPosts(size: number): PopularPostsState {
  const [result, setResult] = useState<{ size: number; state: PopularPostsState } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchPopularPosts(size, controller.signal)
      .then(page => setResult({ size, state: { status: "ready", posts: page.posts } }))
      .catch(() => {
        if (!controller.signal.aborted) setResult({ size, state: { status: "error", posts: [] } });
      });
    return () => controller.abort();
  }, [size]);

  return result?.size === size ? result.state : { status: "loading", posts: [] };
}
