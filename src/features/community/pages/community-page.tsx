import { CommunityDetailScreen } from "@/features/community/community-detail";
import { useRouteCommunity } from "@/features/community/use-route-community";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { useAppSession } from "@/app/session";
import { isCommunityOwner } from "@/features/admin/permissions";
import { moderateCommunityPost } from "@/features/admin/moderate-post";
import { PageState } from "../../../components/app/page-state";
export default function CommunityPage() {
  const { to, galleryId } = useAppNavigation();
  const { currentUserId } = useAppSession();
  const result = useRouteCommunity(galleryId);
  if (result.status !== "ready")
    return (
      <PageState error={result.status !== "loading"}>
        {result.status === "loading" ? "커뮤니티를 불러오는 중..." : "커뮤니티를 찾을 수 없습니다."}
      </PageState>
    );
  const { community } = result;
  return (
    <CommunityDetailScreen
      key={community.galleryId}
      community={community}
      onManage={() => to(`/communities/${community.galleryId}/members`)}
      onModerateDelete={
        isCommunityOwner(community, currentUserId)
          ? (id) => moderateCommunityPost(community, currentUserId, id)
          : undefined
      }
      onProfile={(id) => to(`/users/${id}`)}
      onComments={(id) => to(`/communities/${community.galleryId}/posts/${id}`)}
    />
  );
}
