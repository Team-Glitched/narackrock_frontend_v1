import { CommunityAdminScreen } from "@/features/admin/admin-screens";
import { useRouteCommunity } from "@/features/community/use-route-community";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { PageState } from "@/components/page-state";

/**
 * Where community management leads. Back returns to the community page (`/communities/:id`, which
 * shows managers the "관리자 페이지" button); a community chosen from the manageable list opens there too.
 */
export function useCommunityManagementNavigation(galleryId: number | null) {
  const { to, state } = useUrlNavigation();
  return {
    onBack: () =>
      to(galleryId ? `/communities/${galleryId}` : "/communities", {
        replace: true,
        state: { from: state.from },
      }),
    onSelect: (value: { galleryId: number }) => to(`/communities/${value.galleryId}`),
  };
}

/** `/communities/manage` (no community: the manageable list) and `/communities/:id/members`. */
export function CommunityManagementContent({ galleryId }: { galleryId: number | null }) {
  const navigation = useCommunityManagementNavigation(galleryId);
  const result = useRouteCommunity(galleryId);
  if (galleryId !== null && result.status !== "ready")
    return (
      <PageState error={result.status !== "loading"}>
        {result.status === "loading" ? "커뮤니티를 불러오는 중..." : "커뮤니티를 찾을 수 없습니다."}
      </PageState>
    );
  const community = result.status === "ready" ? result.community : null;
  return <CommunityAdminScreen community={community} {...navigation} />;
}
