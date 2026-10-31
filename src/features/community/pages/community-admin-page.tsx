import { CommunityAdminScreen } from "@/features/admin/admin-screens";
import { useRouteCommunity } from "@/features/community/use-route-community";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { useAppSession } from "@/app/session";
import { moderateCommunityPost } from "@/features/admin/moderate-post";
import { PageState } from "../../../components/app/page-state";
export default function CommunityAdminPage() {
  const { to, page, galleryId, state } = useAppNavigation();
  const { currentUserId } = useAppSession();
  const result = useRouteCommunity(galleryId);
  if (galleryId && result.status !== "ready")
    return (
      <PageState error={result.status !== "loading"}>
        {result.status === "loading" ? "커뮤니티를 불러오는 중..." : "커뮤니티를 찾을 수 없습니다."}
      </PageState>
    );
  const community = result.status === "ready" ? result.community : null;
  const members = page.id === "communityMembers";
  return (
    <CommunityAdminScreen
      community={community}
      currentUserId={currentUserId}
      members={members}
      onMembers={() => {
        if (galleryId) to(`/communities/${galleryId}/members`);
      }}
      onBack={() =>
        to(galleryId ? `/communities/${galleryId}${members ? "/manage" : ""}` : "/communities", {
          replace: true,
          state: { from: state.from },
        })
      }
      onSelect={(value) => to(`/communities/${value.galleryId}/manage`)}
      onComments={(id) => to(galleryId ? `/communities/${galleryId}/posts/${id}` : `/posts/${id}`)}
      onProfile={(id) => to(`/users/${id}`)}
      onDelete={(target, id) => moderateCommunityPost(target, currentUserId, id)}
    />
  );
}
