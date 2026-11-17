import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Avatar } from "@/components/avatar";
import { SectionTitle } from "@/components/section-title";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { relationError } from "@/features/profile/profile-relations";
import { profileStyles } from "@/styles/profile.styles";
import { socialStyles } from "@/styles/social.styles";
import { buttonVariants } from "@/styles/variants";
import {
  mergeRecommendedPeople,
  recommendationFollowState,
  type FollowState,
} from "./recommendations";
import { outgoingRequestsQuery, recommendationsQuery, useFollowMutation } from "./social-queries";
import type { RecommendedPerson } from "@/lib/api/social";

/** Follow recommendations with their follow buttons and paging; the summary (`full` false) shows the first 6. */
export function useRecommendedPeople(full: boolean) {
  const userId = useCurrentUserId();
  const recommendations = useInfiniteQuery(recommendationsQuery(userId));
  const outgoingQuery = useQuery(outgoingRequestsQuery(userId));
  const follow = useFollowMutation();
  const [notice, setNotice] = useState("");

  const pages = recommendations.data?.pages ?? [];
  const loading =
    (recommendations.isFetching && !recommendations.data) || recommendations.isFetchingNextPage;
  const syncing = recommendations.isRefetching;
  // A failed refetch keeps the previous pages; they may be shifted, so paging waits for a successful resync.
  const stale = recommendations.isRefetchError;
  const fallback = stale
    ? "추천 목록 동기화에 실패했습니다."
    : recommendations.isFetchNextPageError
      ? "다음 추천을 불러오지 못했습니다."
      : "추천을 불러오지 못했습니다.";
  const error =
    recommendations.isError && !recommendations.isFetching
      ? relationError(recommendations.error, fallback)
      : "";
  const outgoing = outgoingQuery.isError ? null : (outgoingQuery.data ?? null);
  const checking = outgoingQuery.isFetching && outgoing === null;
  const outgoingError =
    outgoingQuery.isError && !outgoingQuery.isFetching
      ? relationError(outgoingQuery.error, "보낸 팔로우 요청 확인에 실패했습니다.")
      : "";
  const busy = follow.isPending;

  function change(id: number, state: FollowState) {
    if (busy || !outgoing || checking || loading || syncing || stale) return;
    setNotice("");
    follow.mutate(
      { targetId: id, state },
      {
        onSuccess: ({ status: next }) =>
          setNotice(
            next === "PENDING"
              ? "팔로우를 요청했습니다."
              : state === "PENDING"
                ? "팔로우 요청을 취소했습니다."
                : "팔로우 상태를 변경했습니다.",
          ),
        onError: (cause) => setNotice(relationError(cause, "팔로우 상태를 바꾸지 못했습니다.")),
      },
    );
  }

  function more() {
    if (busy || recommendations.isFetching || stale || !recommendations.hasNextPage) return;
    void recommendations.fetchNextPage();
  }

  function retry() {
    if (recommendations.isFetchNextPageError) more();
    else void recommendations.refetch();
  }

  /** The follow button of a recommendation: state, labels and whether it can be pressed now. */
  function followButton(person: RecommendedPerson) {
    const state = recommendationFollowState(person, outgoing ?? []);
    const known = outgoing !== null && !checking;
    return {
      state,
      known,
      label: !known
        ? "확인 중"
        : state === "FOLLOWING"
          ? "팔로잉"
          : state === "PENDING"
            ? "요청됨"
            : "팔로우",
      accessibilityLabel: `${person.nickname} ${!known ? "팔로우 상태 확인" : state === "PENDING" ? "요청 취소" : state === "FOLLOWING" ? "팔로우 해제" : "팔로우"}`,
      disabled: !known || loading || syncing || stale || busy,
    };
  }

  const people = mergeRecommendedPeople(pages);
  const visible = full ? people : people.slice(0, 6);
  const hasMore = recommendations.hasNextPage;
  return {
    loaded: recommendations.data !== undefined,
    refetchOutgoing: () => void outgoingQuery.refetch(),
    notice,
    loading,
    syncing,
    stale,
    error,
    checking,
    outgoingError,
    busy,
    change,
    more,
    retry,
    followButton,
    people,
    visible,
    hasMore,
  };
}

export function RecommendedPeopleList({
  full,
  onProfile,
  onAll,
}: {
  full: boolean;
  onProfile: (id: number) => void;
  onAll?: () => void;
}) {
  const {
    loaded,
    refetchOutgoing,
    notice,
    loading,
    syncing,
    stale,
    error,
    checking,
    outgoingError,
    busy,
    change,
    more,
    retry,
    followButton,
    people,
    visible,
    hasMore,
  } = useRecommendedPeople(full);
  // Like the home charts, the summary always offers the full list, even when it already shows every recommendation.
  const showAll = !full;
  return (
    <section className={socialStyles.friendsSection} aria-label="팔로우 추천">
      <SectionTitle className="px-0" onAll={showAll ? onAll : undefined}>
        팔로우 추천
      </SectionTitle>
      {checking && (
        <p className={socialStyles.friendsEmpty} role="status">
          보낸 팔로우 요청 확인 중...
        </p>
      )}
      {outgoingError && (
        <div role="alert">
          <p>확인 실패: {outgoingError}</p>
          <button disabled={checking} onClick={refetchOutgoing}>
            다시 확인
          </button>
        </div>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          {stale && <p>목록이 최신 상태가 아닙니다. 동기화 후 더 불러올 수 있습니다.</p>}
          <button disabled={loading || syncing || busy} onClick={retry}>
            {stale ? "다시 동기화" : "다시 시도"}
          </button>
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
      {(loading || syncing) && (
        <p className={socialStyles.friendsEmpty} role="status">
          {syncing ? "추천 목록 동기화 중..." : "추천을 불러오는 중..."}
        </p>
      )}
      {!loading && !error && loaded && people.length === 0 && (
        <p className={socialStyles.friendsEmpty}>추천할 사용자가 없습니다.</p>
      )}
      <div className={profileStyles.peopleList}>
        {visible.map((person) => {
          const { state, known, label, accessibilityLabel, disabled } = followButton(person);
          return (
            <div className={socialStyles.person} key={person.userId}>
              <button className={socialStyles.personLink} onClick={() => onProfile(person.userId)}>
                <Avatar size="md" src={person.profileImageUrl} />
                <span>
                  <strong className="truncate">{person.nickname}</strong>
                  <small className="truncate">{person.primaryInstrument ?? ""}</small>
                </span>
              </button>
              <button
                className={buttonVariants({ tone: state ? "secondary" : "primary" })}
                disabled={disabled}
                aria-pressed={known ? state !== null : undefined}
                aria-label={accessibilityLabel}
                onClick={() => change(person.userId, state)}
              >
                {label}
              </button>
            </div>
          );
        })}
      </div>
      {full && hasMore && (
        <button
          className={buttonVariants({ tone: "secondary" })}
          disabled={loading || syncing || stale || busy}
          onClick={more}
        >
          더보기
        </button>
      )}
    </section>
  );
}
