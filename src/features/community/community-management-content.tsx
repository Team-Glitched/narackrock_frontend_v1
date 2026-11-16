import { CommunityAdminScreen } from "@/features/admin/admin-screens";
import { useRouteCommunity } from "@/features/community/use-route-community";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { PageState } from "@/components/page-state";

/** Where community management leads: members, back, a chosen community, posts and profiles. */
export function useCommunityManagementNavigation(galleryId: number | null, members: boolean) {
  const { to, state } = useUrlNavigation();
  return {
    onMembers: () => {
      if (galleryId) to(`/communities/${galleryId}/members`);
    },
    onBack: () =>
      to(galleryId ? `/communities/${galleryId}${members ? "/manage" : ""}` : "/communities", {
        replace: true,
        state: { from: state.from },
      }),
    onSelect: (value: { galleryId: number }) => to(`/communities/${value.galleryId}/manage`),
    onComments: (id: number) =>
      to(galleryId ? `/communities/${galleryId}/posts/${id}` : `/posts/${id}`),
    onProfile: (id: number) => to(`/users/${id}`),
  };
}

export function CommunityManagementContent({
  galleryId,
  members,
}: {
  galleryId: number | null;
  members: boolean;
}) {
  const navigation = useCommunityManagementNavigation(galleryId, members);
  const result = useRouteCommunity(galleryId);
  if (galleryId !== null && result.status !== "ready")
    return (
      <PageState error={result.status !== "loading"}>
        {result.status === "loading" ? "커뮤니티를 불러오는 중..." : "커뮤니티를 찾을 수 없습니다."}
      </PageState>
    );
  const community = result.status === "ready" ? result.community : null;
  return <CommunityAdminScreen community={community} members={members} {...navigation} />;
}
