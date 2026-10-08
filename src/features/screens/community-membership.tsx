"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { fetchSubscribedGalleries, subscribeGallery, unsubscribeGallery } from "@/lib/api/community";

/**
 * 커뮤니티 가입 상태의 저장소 경계.
 *
 * 실제 구현은 `createServerMembershipApi()`(갤러리 구독 API 연동)이고,
 * `createLocalMembershipApi()`는 서버 없이 화면만 볼 때 쓰는 메모리 구현으로 남겨 둔다.
 *
 * userId를 인자로 받는 이유는 로그인 사용자가 바뀌면 목록도 그 사용자 것으로 바뀌어야 하기 때문이다.
 */
export type CommunityMembershipApi = {
  listJoined: (userId: number | null) => Promise<number[]>;
  setJoined: (userId: number | null, communityId: number, joined: boolean) => Promise<void>;
};

/** 화면에 그대로 보여줄 수 있는 실패 사유. 그 외 예외는 일반 문구로 덮는다. */
export class MembershipError extends Error {}

/**
 * 갤러리 구독 API 연동 구현.
 *
 * 비로그인일 때 `listJoined`가 서버를 부르지 않고 빈 목록을 돌려주는 것은 의도적이다 —
 * `GET /api/v1/galleries/subscribed`는 permitAll이 아니라 필터 단계에서 401이 나므로
 * 부를수록 콘솔만 더러워지고 얻는 게 없다(constraints-harness.md C2·C3).
 *
 * 409/404(이미 구독 중 / 구독 중 아님)를 성공으로 흡수하는 처리는 `community.ts` 쪽에 있다.
 */
export function createServerMembershipApi(): CommunityMembershipApi {
  return {
    listJoined: async userId => {
      if (userId === null) return [];
      const galleries = await fetchSubscribedGalleries();
      return galleries.map(gallery => gallery.galleryId);
    },
    setJoined: async (userId, communityId, joined) => {
      if (userId === null) throw new MembershipError("로그인이 필요합니다.");
      if (joined) await subscribeGallery(communityId);
      else await unsubscribeGallery(communityId);
    },
  };
}

// 사용자별 가입 목록. 서버가 없으니 탭을 옮겨 다니는 동안만 유지되고 새로고침하면 초기화된다.
const localJoinedByUser = new Map<string, Set<number>>();
const userKey = (userId: number | null) => (userId === null ? "guest" : String(userId));

export function createLocalMembershipApi(defaultJoinedIds: readonly number[]): CommunityMembershipApi {
  function bucket(userId: number | null): Set<number> {
    const key = userKey(userId);
    let joined = localJoinedByUser.get(key);
    if (!joined) {
      joined = new Set(defaultJoinedIds);
      localJoinedByUser.set(key, joined);
    }
    return joined;
  }
  return {
    listJoined: async userId => [...bucket(userId)],
    setJoined: async (userId, communityId, joined) => {
      const current = bucket(userId);
      if (joined) current.add(communityId);
      else current.delete(communityId);
    },
  };
}

export type CommunityMembership = {
  isJoined: (communityId: number) => boolean;
  isPending: (communityId: number) => boolean;
  toggle: (communityId: number) => void;
  loading: boolean;
  error: string | null;
  loadFailed: boolean;
  retryLoad: () => void;
  /**
   * 가입/탈퇴가 서버에 반영될 때마다 증가한다. 구독자 수는 서버가 집계로 즉시 바꾸는데
   * 목록은 이 Provider가 아니라 화면이 따로 들고 있어서, 목록을 다시 받을 시점을
   * 알리는 신호가 필요하다(useGalleries가 이 값을 의존성으로 쓴다).
   */
  revision: number;
};

const MembershipContext = createContext<CommunityMembership | null>(null);

const NO_DEFAULT_JOINED: readonly number[] = [];

export function CommunityMembershipProvider({ defaultJoinedIds = NO_DEFAULT_JOINED, api, children }: {
  /** 메모리 구현으로 화면만 볼 때 쓰는 초깃값. 재생성을 막기 위해 모듈 상수를 넘긴다. */
  defaultJoinedIds?: readonly number[];
  /** 서버 연동 구현(`createServerMembershipApi()`). 생략하면 메모리 구현을 쓴다. */
  api?: CommunityMembershipApi;
  children: ReactNode;
}) {
  const userId = useCurrentUserId();
  // 계정이 바뀌면 이전 계정의 목록과 진행 중인 요청 상태를 함께 폐기한다.
  return <ScopedMembershipProvider key={userId ?? "guest"} userId={userId} defaultJoinedIds={defaultJoinedIds} api={api}>
    {children}
  </ScopedMembershipProvider>;
}

function ScopedMembershipProvider({ userId, defaultJoinedIds, api, children }: {
  userId: number | null;
  defaultJoinedIds: readonly number[];
  api?: CommunityMembershipApi;
  children: ReactNode;
}) {
  const resolvedApi = useMemo(
    () => api ?? createLocalMembershipApi(defaultJoinedIds),
    [api, defaultJoinedIds],
  );

  const [joinedIds, setJoinedIds] = useState<ReadonlySet<number>>(() => new Set());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [revision, setRevision] = useState(0);
  // 어느 사용자의 목록을 받아 뒀는지. 지금 사용자와 다르면 아직 불러오는 중이다.
  // (loading을 별도 state로 두면 effect 본문에서 setState를 하게 된다)
  const [loadedUserId, setLoadedUserId] = useState<number | null | undefined>(undefined);
  const loading = loadedUserId !== userId || retrying;

  // 로그인 사용자가 바뀌면 그 사용자의 가입 목록을 다시 불러온다.
  useEffect(() => {
    let cancelled = false;
    resolvedApi.listJoined(userId)
      .then(ids => {
        if (cancelled) return;
        setJoinedIds(new Set(ids));
        setLoadFailed(false);
        setRetrying(false);
        setError(null);
        setLoadedUserId(userId);
      })
      .catch(() => {
        if (cancelled) return;
        setJoinedIds(new Set());
        setLoadFailed(true);
        setRetrying(false);
        setError("가입한 커뮤니티를 불러오지 못했습니다.");
        setLoadedUserId(userId);
      });
    return () => { cancelled = true; };
  }, [resolvedApi, userId, reloadToken]);

  const retryLoad = useCallback(() => {
    setRetrying(true);
    setReloadToken(token => token + 1);
  }, []);

  const toggle = useCallback((communityId: number) => {
    if (loading || loadFailed || pendingIds.has(communityId)) return;
    const joining = !joinedIds.has(communityId);

    const apply = (add: boolean) => setJoinedIds(previous => {
      const next = new Set(previous);
      if (add) next.add(communityId);
      else next.delete(communityId);
      return next;
    });

    setPendingIds(previous => new Set(previous).add(communityId));
    setError(null);
    apply(joining); // 서버 응답을 기다리지 않고 먼저 반영한다.

    void resolvedApi.setJoined(userId, communityId, joining)
      // 서버가 구독자 수를 집계로 바로 바꾸므로 목록을 다시 받아야 한다.
      .then(() => setRevision(previous => previous + 1))
      .catch((cause: unknown) => {
        apply(!joining); // 실패하면 되돌린다.
        setError(cause instanceof MembershipError
          ? cause.message
          : joining ? "커뮤니티 가입에 실패했습니다." : "커뮤니티 탈퇴에 실패했습니다.");
      })
      .finally(() => setPendingIds(previous => {
        const next = new Set(previous);
        next.delete(communityId);
        return next;
      }));
  }, [joinedIds, loadFailed, loading, pendingIds, resolvedApi, userId]);

  const value = useMemo<CommunityMembership>(() => ({
    isJoined: communityId => joinedIds.has(communityId),
    isPending: communityId => pendingIds.has(communityId),
    toggle,
    loading,
    error,
    loadFailed,
    retryLoad,
    revision,
  }), [error, joinedIds, loadFailed, loading, pendingIds, retryLoad, revision, toggle]);

  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useCommunityMembership(): CommunityMembership {
  const membership = useContext(MembershipContext);
  if (!membership) throw new Error("CommunityMembershipProvider 안에서만 사용할 수 있습니다.");
  return membership;
}
