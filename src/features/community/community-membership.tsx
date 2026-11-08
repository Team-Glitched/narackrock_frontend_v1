import { useLoginPrompt } from "@/features/auth/login-prompt";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useMutation, useMutationState, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { galleryKeys } from "@/features/community/community-queries";
import {
  fetchSubscribedGalleries,
  subscribeGallery,
  unsubscribeGallery,
} from "@/lib/api/community";

/**
 * 커뮤니티 가입 상태의 저장소 경계.
 *
 * 실제 구현은 `createServerMembershipApi()`(갤러리 구독 API 연동)이고,
 * `createLocalMembershipApi()`는 서버 없이 화면만 볼 때 쓰는 메모리 구현으로 남겨 둔다.
 *
 * userId를 인자로 받는 이유는 로그인 사용자가 바뀌면 목록도 그 사용자 것으로 바뀌어야 하기 때문이다.
 */
export type CommunityMembershipApi = {
  listJoined: (userId: number | null, signal?: AbortSignal) => Promise<number[]>;
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
    listJoined: async (userId, signal) => {
      if (userId === null) return [];
      const galleries = await fetchSubscribedGalleries(signal);
      return galleries.map((gallery) => gallery.galleryId);
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

export function createLocalMembershipApi(
  defaultJoinedIds: readonly number[],
): CommunityMembershipApi {
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
    listJoined: async (userId) => [...bucket(userId)],
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
};

type MembershipChange = { communityId: number; joining: boolean };

const MembershipContext = createContext<CommunityMembership | null>(null);

const NO_DEFAULT_JOINED: readonly number[] = [];

export function CommunityMembershipProvider({
  defaultJoinedIds = NO_DEFAULT_JOINED,
  api,
  children,
}: {
  /** 메모리 구현으로 화면만 볼 때 쓰는 초깃값. 재생성을 막기 위해 모듈 상수를 넘긴다. */
  defaultJoinedIds?: readonly number[];
  /** 서버 연동 구현(`createServerMembershipApi()`). 생략하면 메모리 구현을 쓴다. */
  api?: CommunityMembershipApi;
  children: ReactNode;
}) {
  const userId = useCurrentUserId();
  // 계정이 바뀌면 이전 계정의 가입/탈퇴 실패 문구를 함께 폐기한다.
  return (
    <ScopedMembershipProvider
      key={userId ?? "guest"}
      userId={userId}
      defaultJoinedIds={defaultJoinedIds}
      api={api}
    >
      {children}
    </ScopedMembershipProvider>
  );
}

function ScopedMembershipProvider({
  userId,
  defaultJoinedIds,
  api,
  children,
}: {
  userId: number | null;
  defaultJoinedIds: readonly number[];
  api?: CommunityMembershipApi;
  children: ReactNode;
}) {
  const { requireLogin } = useLoginPrompt();
  const queryClient = useQueryClient();
  const resolvedApi = useMemo(
    () => api ?? createLocalMembershipApi(defaultJoinedIds),
    [api, defaultJoinedIds],
  );
  const joinedKey = useMemo(() => galleryKeys.subscribed(userId), [userId]);
  const membershipKey = useMemo(() => galleryKeys.membership(userId), [userId]);

  const joined = useQuery({
    queryKey: joinedKey,
    queryFn: ({ signal }) => resolvedApi.listJoined(userId, signal),
  });
  const joinedIds = useMemo<ReadonlySet<number>>(() => new Set(joined.data), [joined.data]);
  // 처음 받기에 실패했을 때만 가입 상태를 모르는 것이다. 받아 둔 목록이 있으면 그대로 쓴다.
  const loading = joined.isPending;
  const loadFailed = joined.isLoadingError;

  const [changeError, setChangeError] = useState<string | null>(null);
  const error =
    changeError ?? (loadFailed ? "가입한 커뮤니티를 불러오지 못했습니다." : null);

  const applyJoined = useCallback(
    (communityId: number, add: boolean) =>
      queryClient.setQueryData<number[]>(joinedKey, (ids = []) => {
        const next = new Set(ids);
        if (add) next.add(communityId);
        else next.delete(communityId);
        return [...next];
      }),
    [joinedKey, queryClient],
  );

  const { mutate } = useMutation({
    mutationKey: membershipKey,
    mutationFn: ({ communityId, joining }: MembershipChange) =>
      resolvedApi.setJoined(userId, communityId, joining),
    onMutate: async ({ communityId, joining }) => {
      // 진행 중인 목록 재조회가 먼저 반영한 값을 덮어쓰지 않도록 멈춘다.
      await queryClient.cancelQueries({ queryKey: joinedKey });
      applyJoined(communityId, joining); // 서버 응답을 기다리지 않고 먼저 반영한다.
    },
    // 서버가 구독자 수를 집계로 바로 바꾸므로 갤러리 목록을 다시 받아야 한다.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: galleryKeys.list(userId) }),
    onError: (cause, { communityId, joining }) => {
      applyJoined(communityId, !joining); // 실패하면 되돌린다.
      setChangeError(
        cause instanceof MembershipError
          ? cause.message
          : joining
            ? "커뮤니티 가입에 실패했습니다."
            : "커뮤니티 탈퇴에 실패했습니다.",
      );
    },
  });

  const pendingList = useMutationState({
    filters: { mutationKey: membershipKey, status: "pending" },
    select: (mutation) => (mutation.state.variables as MembershipChange).communityId,
  });
  const pendingIds = useMemo<ReadonlySet<number>>(() => new Set(pendingList), [pendingList]);

  const toggle = useCallback(
    (communityId: number) => {
      if (!requireLogin() || loading || loadFailed) return;
      // 캐시를 직접 읽어 두 번 연달아 누른 클릭도 진행 중인 요청을 본다.
      const inFlight = queryClient.isMutating({
        mutationKey: membershipKey,
        predicate: (mutation) =>
          (mutation.state.variables as MembershipChange | undefined)?.communityId === communityId,
      });
      if (inFlight > 0) return;
      const joining = !(queryClient.getQueryData<number[]>(joinedKey) ?? []).includes(communityId);
      setChangeError(null);
      mutate({ communityId, joining });
    },
    [joinedKey, loadFailed, loading, membershipKey, mutate, queryClient, requireLogin],
  );

  const { refetch } = joined;
  const retryLoad = useCallback(() => {
    void refetch();
  }, [refetch]);

  const value = useMemo<CommunityMembership>(
    () => ({
      isJoined: (communityId) => joinedIds.has(communityId),
      isPending: (communityId) => pendingIds.has(communityId),
      toggle,
      loading,
      error,
      loadFailed,
      retryLoad,
    }),
    [error, joinedIds, loadFailed, loading, pendingIds, retryLoad, toggle],
  );

  return <MembershipContext.Provider value={value}>{children}</MembershipContext.Provider>;
}

export function useCommunityMembership(): CommunityMembership {
  const membership = useContext(MembershipContext);
  if (!membership) throw new Error("CommunityMembershipProvider 안에서만 사용할 수 있습니다.");
  return membership;
}
