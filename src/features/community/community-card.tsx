import { LoaderCircle } from "lucide-react";
import { communityStyles } from "@/styles/community.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { Avatar } from "@/components/avatar";
import type { GalleryListItem } from "@/lib/api/contracts";
import { useCommunityMembership } from "./community-membership";

// 가입한 커뮤니티 / 추천 커뮤니티가 함께 쓰는 표현 계층.
export type Community = {
  /** 목록 안에서의 고유 식별자. React key와 가입 상태 관리에 쓴다. */
  id: number;
  ownerId?: number;
  /** 게시글을 읽어올 백엔드 갤러리 id. 서버 연동 뒤로는 `id`와 같은 값이다. */
  galleryId: number;
  name: string;
  memberCount: number;
  description: string;
  imageUrl: string | null;
  imageFileId?: number | null;
  bannerImageFileId?: number | null;
  bannerImageUrl?: string | null;
};

/**
 * 갤러리 목록 응답 → 화면 모델.
 *
 * `id`와 `galleryId`를 둘 다 같은 값으로 채운다. 갤러리 목록 API가 없던 시절에는 예시
 * 커뮤니티 번호와 실제 갤러리 id가 달라서 두 필드가 필요했는데, 이제는 하나다. 그래도
 * 필드를 합치지 않은 것은 카드/상세/가입 버튼이 모두 이 타입을 쓰고 있어 변경면이 커지기
 * 때문이다 — 통합이 끝난 뒤 정리한다.
 *
 * 설명과 이미지는 등록되어 있지 않으면 비어 있을 수 있다.
 */
export function galleryToCommunity(gallery: GalleryListItem): Community {
  return {
    id: gallery.galleryId,
    galleryId: gallery.galleryId,
    name: gallery.name,
    memberCount: gallery.subscriberCount,
    description: gallery.description ?? "",
    imageUrl: gallery.imageUrl ?? null,
    imageFileId: gallery.imageFileId,
    bannerImageFileId: gallery.bannerImageFileId,
    bannerImageUrl: gallery.bannerImageUrl,
    ownerId: gallery.ownerId,
  };
}

export function memberLabel(memberCount: number): string {
  return `가입자 ${memberCount.toLocaleString("ko-KR")}명`;
}

// 가입됨은 체크된 상태라 어둡게, 미가입은 원래 보라색으로 돌아온다.
// 가입 상태는 CommunityMembershipProvider가 들고 있어 목록·전체목록·상세가 같은 값을 본다.
export function CommunityJoinButton({
  community,
  block = false,
}: {
  community: Community;
  block?: boolean;
}) {
  const userId = useCurrentUserId();
  const membership = useCommunityMembership();
  const joined = membership.isJoined(community.id);
  const pending = membership.isPending(community.id);
  const { loading, loadFailed } = membership;
  const statusUnknown = loading || loadFailed;
  const label = loading
    ? "가입 상태 확인 중"
    : loadFailed
      ? "가입 상태를 불러오지 못했습니다"
      : joined
        ? "가입됨 — 누르면 탈퇴"
        : "가입하기";
  // The creator cannot leave their own gallery, so the join control shows a fixed badge (display only).
  if (userId !== null && community.ownerId === userId)
    return (
      <span
        className={cn(
          cn(
            communityStyles.communityJoin,
            sharedStyles.isJoined,
            communityStyles.communityOwnerBadge,
          ),
          block ? communityStyles.communityJoinBlock : "",
        )}
      >
        가입됨
      </span>
    );
  return (
    <button
      className={cn(
        communityStyles.communityJoin,
        joined && !statusUnknown ? sharedStyles.isJoined : "",
        block ? communityStyles.communityJoinBlock : "",
      )}
      aria-pressed={statusUnknown ? undefined : joined}
      aria-busy={pending || loading}
      disabled={pending || statusUnknown}
      aria-label={`${community.name} ${label}`}
      onClick={() => membership.toggle(community.id)}
    >
      <span aria-hidden="true" className="grid place-items-center">
        <span className="invisible col-start-1 row-start-1">가입됨</span>
        {loading ? (
          <LoaderCircle className="col-start-1 row-start-1 size-4 motion-safe:animate-spin" />
        ) : (
          <span className="col-start-1 row-start-1">
            {loadFailed ? "‒" : joined ? "가입됨" : "가입"}
          </span>
        )}
      </span>
    </button>
  );
}

type CardProps = {
  community: Community;
  onOpen?: (community: Community) => void;
  /** 화면의 제목 단계에 맞춘다 — 목록 위 제목이 h1이면 2, h2면 3. */
  headingLevel?: 2 | 3;
};

// 가로로 넓은 카드: 아바타 · 이름 · 가입자 수 · 가입 버튼 · 설명.
export function CommunityCard({ community, onOpen, headingLevel = 3 }: CardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <li className={communityStyles.communityCard}>
      <div className={communityStyles.communityCardHeader}>
        <Avatar src={community.imageUrl} />
        <div className={communityStyles.communityCardTitle}>
          <Heading className="w-full min-w-0">
            {onOpen ? (
              <button
                className={communityStyles.communityOpen}
                aria-label={`${community.name} 커뮤니티 열기`}
                onClick={() => onOpen(community)}
              >
                <span className="block truncate" title={community.name}>{community.name}</span>
              </button>
            ) : (
              <span className="block truncate" title={community.name}>{community.name}</span>
            )}
          </Heading>
          <p>{memberLabel(community.memberCount)}</p>
        </div>
        <CommunityJoinButton community={community} />
      </div>
      {community.description && (
        <p className={communityStyles.communityCardDescription}>{community.description}</p>
      )}
    </li>
  );
}

// 가로 스크롤 레일용 좁은 세로 카드. 설명은 자리가 없어 싣지 않는다.
export function CommunityRailCard({ community, onOpen, headingLevel = 3 }: CardProps) {
  const Heading = `h${headingLevel}` as "h2" | "h3";
  return (
    <li className={communityStyles.communityRailCard}>
      <Avatar src={community.imageUrl} />
      <Heading className="w-full min-w-0">
        {onOpen ? (
          <button
            className={communityStyles.communityOpen}
            aria-label={`${community.name} 커뮤니티 열기`}
            onClick={() => onOpen(community)}
          >
            <span className="block truncate" title={community.name}>{community.name}</span>
          </button>
        ) : (
          <span className="block truncate" title={community.name}>{community.name}</span>
        )}
      </Heading>
      <p>{memberLabel(community.memberCount)}</p>
      <CommunityJoinButton community={community} block />
    </li>
  );
}
