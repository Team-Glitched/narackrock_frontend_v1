"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchGalleries } from "@/lib/api/community";
import type { GalleryListItem } from "@/lib/api/contracts";

export type GalleriesState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; galleries: GalleryListItem[] };

/**
 * 전체 갤러리 목록. 비로그인도 볼 수 있고 페이지네이션 없이 전량이 온다.
 *
 * 가입 목록을 따로 받지 않는 이유: 전량이 오므로 `구독한 갤러리 ⊆ 전체 갤러리`가 보장된다.
 * 가입 여부는 CommunityMembershipProvider가 들고 있는 id 집합으로 갈라 쓰면 되고,
 * 그러면 목록 호출이 화면당 한 번으로 끝난다.
 *
 * @param revision 가입/탈퇴가 서버에 반영될 때마다 바뀌는 값(`useCommunityMembership().revision`).
 *   구독자 수가 집계라 구독 직후 값이 달라지므로, 이 값이 바뀌면 목록을 다시 받는다.
 */
export function useGalleries(revision: number): GalleriesState & { refetch: () => void } {
  const [state, setState] = useState<GalleriesState>({ status: "loading" });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetchGalleries()
      .then((galleries) => {
        if (!cancelled) setState({ status: "ready", galleries });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [revision, reloadToken]);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, refetch };
}
