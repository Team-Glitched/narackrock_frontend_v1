import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { SectionTitle } from "@/components/section-title";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import type { ReactNode } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useGalleries } from "@/features/community/use-galleries";
import { galleryToCommunity, type Community } from "./community-card";
import { CommunityCard, CommunityRailCard } from "./community-card";
import { useCommunityMembership, type CommunityMembership } from "./community-membership";

/** The join/leave failure shown under the lists; a failed membership load is reported by the lists themselves. */
export function membershipChangeError({ error, loadFailed }: CommunityMembership): string | null {
  return error && !loadFailed ? error : null;
}

// 가입/탈퇴 실패는 세 화면이 같은 자리에서 알린다.
function MembershipError() {
  const error = membershipChangeError(useCommunityMembership());
  return error ? (
    <p className={sharedStyles.membershipError} role="alert">
      {error}
    </p>
  ) : null;
}

export type DirectoryState = {
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
export function useCommunityDirectory(): DirectoryState {
  const membership = useCommunityMembership();
  const galleries = useGalleries();

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

function JoinedList({
  state,
  children,
}: {
  state: DirectoryState;
  children: (joined: Community[]) => ReactNode;
}) {
  const view = joinedListView(state);
  if (view === "loading") return <LoadingRow />;
  if (view === "failed") return <FailedRow onRetry={state.retry} message={state.failureMessage} />;
  if (view === "empty")
    return <p className={communityStyles.communityDetailStatus}>아직 가입한 커뮤니티가 없어요.</p>;
  return <>{children(state.joined)}</>;
}

/** What the joined list shows. */
export function joinedListView(state: DirectoryState): "loading" | "failed" | "empty" | "list" {
  if (state.loading) return "loading";
  if (state.failed) return "failed";
  return state.joined.length === 0 ? "empty" : "list";
}

/**
 * What the "추천 커뮤니티" section shows; null hides it. A guest sees the directory's loading and failure here;
 * a member sees the section only while it has communities.
 */
export function recommendedView(
  state: DirectoryState,
  signedIn: boolean,
): "failed" | "loading" | "empty" | "list" | null {
  if (signedIn && state.recommended.length === 0) return null;
  if (state.failed && !signedIn) return "failed";
  if (!state.failed && state.loading && !signedIn && state.recommended.length === 0)
    return "loading";
  return state.recommended.length === 0 ? "empty" : "list";
}

export function CommunityDirectory({
  onJoined,
  onOpen,
}: {
  onJoined: () => void;
  onOpen: (community: Community) => void;
}) {
  const userId = useCurrentUserId();
  const state = useCommunityDirectory();
  const recommended = recommendedView(state, userId !== null);

  return (
    <div className={communityStyles.communityDirectory}>
      {/* A guest has no memberships, so the joined section is not shown at all. */}
      {userId !== null && (
        <section aria-labelledby="joined-communities-heading">
          <SectionTitle
            id="joined-communities-heading"
            className="directory-heading"
            onAll={onJoined}
          >
            가입한 커뮤니티
          </SectionTitle>
          <JoinedList state={state}>
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
      )}

      {recommended !== null && (
        <section
          className={sharedStyles.recommendedCommunities}
          aria-labelledby="recommended-communities-heading"
        >
          <SectionTitle id="recommended-communities-heading" className="directory-heading">
            추천 커뮤니티
          </SectionTitle>
          {recommended === "failed" ? (
            <FailedRow onRetry={state.retry} message={state.failureMessage} />
          ) : recommended === "loading" ? (
            <LoadingRow />
          ) : recommended === "empty" ? (
            <p className={communityStyles.communityDetailStatus}>
              가입하지 않은 커뮤니티가 없어요.
            </p>
          ) : (
            <ul className={communityStyles.communityCardList} aria-label="추천 커뮤니티 목록">
              {state.recommended.map((community) => (
                <CommunityCard key={community.id} community={community} onOpen={onOpen} />
              ))}
            </ul>
          )}
        </section>
      )}
      <MembershipError />
    </div>
  );
}

// Community.pdf의 "가입한 커뮤니티" 전체 목록 화면.
// 뒤로가기/알림/검색/프로필 헤더는 page.tsx의 공용 Header가 그린다.
export function JoinedCommunitiesScreen({ onOpen }: { onOpen: (community: Community) => void }) {
  const state = useCommunityDirectory();

  return (
    <div className={cn(sharedStyles.joinedView, sharedStyles.scrollContent)}>
      <h1 className={sharedStyles.joinedTitle}>가입한 커뮤니티</h1>
      <JoinedList state={state}>
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
