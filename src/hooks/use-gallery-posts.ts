"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchPosts } from "@/lib/api/community";
import type { PostListItem } from "@/lib/api/contracts";

export type GalleryPostsState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; posts: PostListItem[] };

export function useGalleryPosts(galleryId: number): GalleryPostsState & { refetch: () => void } {
  const [state, setState] = useState<GalleryPostsState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchPosts(galleryId)
      .then((result) => {
        if (!cancelled) setState({ status: "ready", posts: result.posts });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [galleryId, reloadToken]);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, refetch };
}
