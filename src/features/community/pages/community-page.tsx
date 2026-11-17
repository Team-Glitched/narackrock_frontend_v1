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
import { parsePostSort } from "@/features/posts/post-sort";
import { creationTarget } from "@/features/navigation/creation-target";
import { nativeApp } from "@/lib/native-app";
import {
  NativeCommunityDetailBridge,
  NativePageStateBridge,
} from "@/features/community/native-community-bridge";

function CommunityContent({
  galleryId,
  onBack,
  onSearch,
}: {
  galleryId: number;
  onBack: () => void;
  onSearch: () => void;
}) {
  const { to, query } = useUrlNavigation();
  const result = useRouteCommunity(galleryId);
  const create = () => to(creationTarget("posts", galleryId).path);
  if (result.status !== "ready") {
    const message =
      result.status === "loading" ? "커뮤니티를 불러오는 중..." : "커뮤니티를 찾을 수 없습니다.";
    return nativeApp() ? (
      <NativePageStateBridge
        state={{
          message,
          tone: result.status === "loading" ? "muted" : "error",
          createLabel: "글쓰기",
        }}
        onBack={onBack}
        onSearch={onSearch}
        onCreate={create}
      />
    ) : (
      <PageState error={result.status !== "loading"}>{message}</PageState>
    );
  }
  const { community } = result;
  const sort = parsePostSort(query.get("sort"));
  const onManage = () => to(`/communities/${community.galleryId}/members`);
  const onProfile = (id: number) => to(`/users/${id}`);
  const onComments = (id: number) => to(`/communities/${community.galleryId}/posts/${id}`);
  return nativeApp() ? (
    <NativeCommunityDetailBridge
      key={community.galleryId}
      community={community}
      sort={sort}
      onManage={onManage}
      onProfile={onProfile}
      onComments={onComments}
      onBack={onBack}
      onSearch={onSearch}
      onCreate={create}
    />
  ) : (
    <CommunityDetailScreen
      key={community.galleryId}
      community={community}
      sort={sort}
      onManage={onManage}
      onProfile={onProfile}
      onComments={onComments}
    />
  );
}

export default function CommunityPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "posts", Boolean(galleryId));
  const validGalleryId = readId(params.galleryId);
  const onBack = () => back("/communities");
  const onSearch = () => to(withQuery("/search", { scope, galleryId }));
  if (nativeApp())
    return (
      <>
        {validGalleryId === null ? (
          <NativePageStateBridge
            state={{
              message: "올바르지 않은 페이지 주소입니다.",
              tone: "error",
              createLabel: null,
            }}
            onBack={onBack}
            onSearch={onSearch}
          />
        ) : (
          <CommunityContent galleryId={validGalleryId} onBack={onBack} onSearch={onSearch} />
        )}
        <Footer activeTab="social" />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={onBack} onSearch={onSearch} />
        <div className={contextualCreateArea}>
          {validGalleryId === null ? (
            <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
          ) : (
            <CommunityContent galleryId={validGalleryId} onBack={onBack} onSearch={onSearch} />
          )}
          {validGalleryId !== null && <ContextualCreate scope="posts" galleryId={validGalleryId} />}
        </div>
        <Footer activeTab="social" />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
