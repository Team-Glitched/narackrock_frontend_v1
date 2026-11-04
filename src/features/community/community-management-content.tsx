import { CommunityAdminScreen } from "@/features/admin/admin-screens";
import { useRouteCommunity } from "@/features/community/use-route-community";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { PageState } from "@/components/ui/page-state";

export function CommunityManagementContent({ galleryId, members }: {
  galleryId: number | null;
  members: boolean;
}) {
  const { to, state } = useUrlNavigation();
  const result = useRouteCommunity(galleryId);
  if (galleryId !== null && result.status !== "ready")
    return (
      <PageState error={result.status !== "loading"}>
        {result.status === "loading" ? "커뮤니티를 불러오는 중..." : "커뮤니티를 찾을 수 없습니다."}
      </PageState>
    );
  const community = result.status === "ready" ? result.community : null;
  return (
    <CommunityAdminScreen
      community={community}
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
    />
  );
}
