"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useCurrentUserId } from "@/hooks/use-current-user";

/**
 * 커뮤니티 가입 상태의 저장소 경계.
 *
 * 갤러리 구독 API가 아직 백엔드에 없어 지금은 메모리 구현(`createLocalMembershipApi`)을 쓴다.
 * API가 생기면 이 인터페이스를 구현한 객체를 Provider의 `api` prop으로 넘기는 것만으로
 * 화면 코드는 그대로 두고 서버 연동으로 바꿀 수 있다. 예를 들어:
 *
 *   listJoined: userId => fetchJoinedGalleries().then(r => r.galleries.map(g => g.galleryId))
 *   setJoined:  (userId, id, joined) => joined ? joinGallery(id) : leaveGallery(id)
 *
 * userId를 인자로 받는 이유는 로그인 사용자가 바뀌면 목록도 그 사용자 것으로 바뀌어야 하기 때문이다.
 */
export type CommunityMembershipApi = {
  listJoined: (userId: number | null) => Promise<number[]>;
  setJoined: (userId: number | null, communityId: number, joined: boolean) => Promise<void>;
};

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
};

const MembershipContext = createContext<CommunityMembership | null>(null);

export function CommunityMembershipProvider({ defaultJoinedIds, api, children }: {
  /** 서버 목록이 생기기 전까지 쓸 초깃값. 재생성을 막기 위해 모듈 상수를 넘긴다. */
  defaultJoinedIds: readonly number[];
  /** 실제 API가 준비되면 이 prop으로 주입한다. 생략하면 메모리 구현을 쓴다. */
  api?: CommunityMembershipApi;
  children: ReactNode;
}) {
  const userId = useCurrentUserId();
  const resolvedApi = useMemo(
    () => api ?? createLocalMembershipApi(defaultJoinedIds),
    [api, defaultJoinedIds],
  );

  const [joinedIds, setJoinedIds] = useState<ReadonlySet<number>>(() => new Set());
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(() => new Set());
  const [error, setError] = useState<string | null>(null);
  // 어느 사용자의 목록을 받아 뒀는지. 지금 사용자와 다르면 아직 불러오는 중이다.
  // (loading을 별도 state로 두면 effect 본문에서 setState를 하게 된다)
  const [loadedUserId, setLoadedUserId] = useState<number | null | undefined>(undefined);
  const loading = loadedUserId !== userId;

  // 로그인 사용자가 바뀌면 그 사용자의 가입 목록을 다시 불러온다.
  useEffect(() => {
    let cancelled = false;
    resolvedApi.listJoined(userId)
      .then(ids => {
        if (cancelled) return;
        setJoinedIds(new Set(ids));
        setError(null);
        setLoadedUserId(userId);
      })
      .catch(() => {
        if (cancelled) return;
        setError("가입한 커뮤니티를 불러오지 못했습니다.");
        setLoadedUserId(userId);
      });
    return () => { cancelled = true; };
  }, [resolvedApi, userId]);

  const toggle = useCallback((communityId: number) => {
    if (pendingIds.has(communityId)) return;
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
      .catch(() => {
        apply(!joining); // 실패하면 되돌린다.
        setError(joining ? "커뮤니티 가입에 실패했습니다." : "커뮤니티 탈퇴에 실패했습니다.");
      })
      .finally(() => setPendingIds(previous => {
        const next = new Set(previous);
        next.delete(communityId);
        return next;
      }));
  }, [joinedIds, pendingIds, resolvedApi, userId]);

  const value = useMemo<CommunityMembership>(() => ({
    isJoined: communityId => joinedIds.has(communityId),
    isPending: communityId => pendingIds.has(communityId),
    toggle,
    loading,
    error,
  }), [error, joinedIds, loading, pendingIds, toggle]);

  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useCommunityMembership(): CommunityMembership {
  const membership = useContext(MembershipContext);
  if (!membership) throw new Error("CommunityMembershipProvider 안에서만 사용할 수 있습니다.");
  return membership;
}
