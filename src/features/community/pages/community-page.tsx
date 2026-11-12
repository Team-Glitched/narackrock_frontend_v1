import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { ContextualCreate, contextualCreateArea } from "@/features/navigation/contextual-create";
import { sharedStyles } from "@/styles/shared.styles";
import { CommunityDetailScreen } from "@/features/community/community-detail";
import { useRouteCommunity } from "@/features/community/use-route-community";
import { PageState } from "@/components/page-state";
import { parsePostSort, postSortQuery } from "@/features/posts/post-sort";

function CommunityContent({ galleryId }: { galleryId: number }) {
  const { to, query } = useUrlNavigation();
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
      sort={parsePostSort(query.get("sort"))}
      onSortChange={(sort) => to(`/communities/${community.galleryId}?${postSortQuery(query, sort)}`)}
      onManage={() => to(`/communities/${community.galleryId}/members`)}
      onProfile={(id) => to(`/users/${id}`)}
      onComments={(id) => to(`/communities/${community.galleryId}/posts/${id}`)}
    />
  );
}

export default function CommunityPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "posts", Boolean(galleryId));
  const validGalleryId = readId(params.galleryId);
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header
          onBack={() => back("/communities")}
          onSearch={() => to(withQuery("/search", { scope, galleryId }))}
        />
        <div className={contextualCreateArea}>
          {validGalleryId === null ? (
            <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
          ) : (
            <CommunityContent galleryId={validGalleryId} />
          )}
          {validGalleryId !== null && <ContextualCreate scope="posts" galleryId={validGalleryId} />}
        </div>
        <Footer activeTab="social" />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
