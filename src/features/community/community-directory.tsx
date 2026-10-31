import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import type { ReactNode } from "react";
import type { Navigate } from "@/features/navigation/types";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useGalleries } from "@/features/community/use-galleries";
import { galleryToCommunity, type Community } from "./community-card";
import { CommunityCard, CommunityRailCard } from "./community-card";
import { useCommunityMembership } from "./community-membership";

// 가입/탈퇴 실패는 세 화면이 같은 자리에서 알린다.
function MembershipError() {
  const { error, loadFailed } = useCommunityMembership();
  return error && !loadFailed ? (
    <p className={sharedStyles.membershipError} role="alert">
      {error}
    </p>
  ) : null;
}

type DirectoryState = {
  /** 목록과 가입 상태가 둘 다 도착하기 전. 가입 여부로 가르려면 둘 다 있어야 한다. */
  loading: boolean;
  failed: boolean;
  failureMessage: string;
  joined: Community[];
  recommended: Community[];
  retry: () => void;
};

/**
 * 전체 갤러리 목록을 받아 가입/미가입으로 가른다.
 *
 * 목록 호출은 한 번이다 — `GET /api/v1/galleries`가 전량을 주므로
 * `구독한 갤러리 ⊆ 전체 갤러리`가 성립해서, 가입 목록을 따로 받을 필요가 없다.
 */
function useDirectory(): DirectoryState {
  const membership = useCommunityMembership();
  const galleries = useGalleries(membership.revision);

  const split = useMemo(() => {
    if (galleries.status !== "ready") return { joined: [], recommended: [] };
    const communities = galleries.galleries.map(galleryToCommunity);
    return {
      joined: communities.filter((community) => membership.isJoined(community.id)),
      recommended: communities.filter((community) => !membership.isJoined(community.id)),
    };
  }, [galleries, membership]);

  return {
    loading: galleries.status === "loading" || membership.loading,
    failed: galleries.status === "error" || membership.loadFailed,
    failureMessage: membership.loadFailed
      ? "가입한 커뮤니티를 불러오지 못했습니다."
      : "커뮤니티 목록을 불러오지 못했습니다.",
    ...split,
    retry: membership.loadFailed ? membership.retryLoad : galleries.refetch,
  };
}

function LoadingRow() {
  return (
    <p className={communityStyles.communityDetailStatus} role="status">
      커뮤니티를 불러오는 중...
    </p>
  );
}

function FailedRow({ onRetry, message }: { onRetry: () => void; message: string }) {
  return (
    <div className={communityStyles.communityDetailStatus} role="alert">
      <p>{message}</p>
      <button
        className={buttonVariants({
          tone: "secondary",
        })}
        onClick={onRetry}
      >
        다시 시도
      </button>
    </div>
  );
}

// 가입 목록은 비로그인이면 서버를 부르지 않고 비어 있다 — 빈 목록과 구분해서 안내한다.
function JoinedList({
  state,
  userId,
  children,
}: {
  state: DirectoryState;
  userId: number | null;
  children: (joined: Community[]) => ReactNode;
}) {
  if (state.loading) return <LoadingRow />;
  if (state.failed) return <FailedRow onRetry={state.retry} message={state.failureMessage} />;
  if (userId === null)
    return (
      <p className={sharedStyles.directoryNotice}>로그인하면 가입한 커뮤니티를 볼 수 있어요.</p>
    );
  if (state.joined.length === 0)
    return <p className={communityStyles.communityDetailStatus}>아직 가입한 커뮤니티가 없어요.</p>;
  return <>{children(state.joined)}</>;
}

export function CommunityDirectory({
  go,
  onOpen,
}: {
  go: Navigate;
  onOpen: (community: Community) => void;
}) {
  const userId = useCurrentUserId();
  const state = useDirectory();

  return (
    <div className={communityStyles.communityDirectory}>
      <section aria-labelledby="joined-communities-heading">
        <div className={sharedStyles.directoryHeading}>
          <h2 id="joined-communities-heading">가입한 커뮤니티</h2>
          <button onClick={() => go("joined")}>모두보기</button>
        </div>
        <JoinedList state={state} userId={userId}>
          {(joined) => (
            <ul
              className={communityStyles.communityRail}
              tabIndex={0}
              aria-label="가입한 커뮤니티 목록"
            >
              {joined.slice(0, 4).map((community) => (
                <CommunityRailCard key={community.id} community={community} onOpen={onOpen} />
              ))}
            </ul>
          )}
        </JoinedList>
      </section>

      <section
        className={sharedStyles.recommendedCommunities}
        aria-labelledby="recommended-communities-heading"
      >
        <div className={sharedStyles.directoryHeading}>
          <h2 id="recommended-communities-heading">추천 커뮤니티</h2>
        </div>
        {state.failed ? null : state.loading ? (
          <LoadingRow />
        ) : state.recommended.length === 0 ? (
          <p className={communityStyles.communityDetailStatus}>가입하지 않은 커뮤니티가 없어요.</p>
        ) : (
          <ul className={communityStyles.communityCardList} aria-label="추천 커뮤니티 목록">
            {state.recommended.map((community) => (
              <CommunityCard key={community.id} community={community} onOpen={onOpen} />
            ))}
          </ul>
        )}
      </section>
      <MembershipError />
    </div>
  );
}

// Community.pdf의 "가입한 커뮤니티" 전체 목록 화면.
// 뒤로가기/알림/검색/프로필 헤더는 page.tsx의 공용 Header가 그린다.
export function JoinedCommunitiesScreen({ onOpen }: { onOpen: (community: Community) => void }) {
  const userId = useCurrentUserId();
  const state = useDirectory();

  return (
    <div className={cn(sharedStyles.joinedView, sharedStyles.scrollContent)}>
      <h1 className={sharedStyles.joinedTitle}>가입한 커뮤니티</h1>
      <JoinedList state={state} userId={userId}>
        {(joined) => (
          <ul className={communityStyles.communityCardList} aria-label="가입한 커뮤니티 목록">
            {joined.map((community) => (
              <CommunityCard
                key={community.id}
                community={community}
                onOpen={onOpen}
                headingLevel={2}
              />
            ))}
          </ul>
        )}
      </JoinedList>
      <MembershipError />
    </div>
  );
}
