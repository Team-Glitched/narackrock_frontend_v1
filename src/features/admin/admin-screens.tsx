import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { socialStyles } from "@/styles/social.styles";
import { Asset } from "@/components/app/shared";
import { CommunityDetailScreen } from "@/features/community/community-detail";
import { galleryToCommunity, type Community } from "@/features/community/community-card";
import { useGalleries } from "@/features/community/use-galleries";
import { isCommunityOwner } from "./permissions";

export function AdminReviewScreen() {
  return (
    <section className={cn("admin-view", sharedStyles.scrollContent)} aria-label="관리자 화면">
      <h1>관리자</h1>
      <p role="status">현재 관리자 검토 기능을 사용할 수 없습니다.</p>
    </section>
  );
}

type CommunityAdminProps = {
  community: Community | null;
  currentUserId: number | null;
  members: boolean;
  onMembers: () => void;
  onBack: () => void;
  onSelect: (community: Community) => void;
  onComments: (postId: number) => void;
  onProfile: (userId: number) => void;
  onDelete: (community: Community, postId: number) => Promise<void>;
};
export function CommunityAdminScreen(props: CommunityAdminProps) {
  const galleries = useGalleries(0);
  const available =
    galleries.status === "ready"
      ? galleries.galleries.filter((gallery) => isCommunityOwner(gallery, props.currentUserId))
      : [];
  const community = props.community ?? (available[0] ? galleryToCommunity(available[0]) : null);
  if (!community)
    return (
      <section className={cn(communityStyles.communityAdminStatus, sharedStyles.scrollContent)}>
        <h1>커뮤니티 관리</h1>
        <p role="status">
          {galleries.status === "loading"
            ? "커뮤니티를 불러오는 중..."
            : galleries.status === "error"
              ? "커뮤니티를 불러오지 못했습니다."
              : "관리할 수 있는 커뮤니티가 없습니다."}
        </p>
        {galleries.status === "error" && (
          <button
            className={buttonVariants({
              tone: "secondary",
            })}
            onClick={galleries.refetch}
          >
            다시 시도
          </button>
        )}
      </section>
    );
  if (!isCommunityOwner(community, props.currentUserId))
    return (
      <section className={communityStyles.communityAdminStatus}>
        <h1>커뮤니티 관리</h1>
        <p role="alert">커뮤니티 개설자만 관리할 수 있습니다.</p>
        <button
          className={buttonVariants({
            tone: "secondary",
          })}
          onClick={props.onBack}
        >
          돌아가기
        </button>
      </section>
    );
  if (props.members) return <CommunityMembers community={community} onBack={props.onBack} />;
  return (
    <CommunityDetailScreen
      community={community}
      onManage={() => {
        props.onSelect(community);
        props.onMembers();
      }}
      onComments={(postId) => {
        props.onSelect(community);
        props.onComments(postId);
      }}
      onProfile={props.onProfile}
      onModerateDelete={(postId) => props.onDelete(community, postId)}
    />
  );
}
function CommunityMembers({ community, onBack }: { community: Community; onBack: () => void }) {
  return (
    <section
      className={communityStyles.communityMembersView}
      aria-label={`${community.name} 멤버 관리`}
    >
      <div className={socialStyles.searchLine}>
        <button onClick={onBack} aria-label="돌아가기">
          <Asset name="search-back.svg" />
        </button>
      </div>
      <p className={communityStyles.communityAdminEmpty} role="status">
        현재 멤버 목록을 사용할 수 없습니다.
      </p>
    </section>
  );
}
