import { DesignViewport } from "@/components/ui/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { creationTarget } from "@/features/navigation/creation-target";
import { sharedStyles } from "@/styles/shared.styles";
import { CommunityDetailScreen } from "@/features/community/community-detail";
import { useRouteCommunity } from "@/features/community/use-route-community";
import { PageState } from "@/components/ui/page-state";

function CommunityContent({ galleryId }: { galleryId: number }) {
  const { to } = useUrlNavigation();
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
      onProfile={(id) => to(`/users/${id}`)}
      onComments={(id) => to(`/communities/${community.galleryId}/posts/${id}`)}
    />
  );
}

export default function CommunityPage() {
  const { to, back, params, query, currentPath } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "posts", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  const validGalleryId = readId(params.galleryId);
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header
          onBack={() => back("/communities")}
          onSearch={() => to(withQuery("/search", { scope, galleryId }))}
        />
        <div className={sharedStyles.screenBody}>
          {validGalleryId === null ? (
            <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
          ) : (
            <CommunityContent galleryId={validGalleryId} />
          )}
        </div>
        <Footer
          activeTab="social"
          onCreate={() => to(target.path, target.path === "/studio/new" ? {
            state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
          } : undefined)}
          createLabel={target.label}
        />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
