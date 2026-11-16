import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
import { PostCommentsScreen } from "@/features/posts/post-comments";
import { NativeInvalidPostBridge } from "@/features/posts/native-post-detail-bridge";
import { PageState } from "@/components/page-state";
import { nativeApp } from "@/lib/native-app";

export default function PostPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "posts", Boolean(galleryId));
  const postId = readId(params.postId);
  const invalidGalleryId = params.galleryId !== undefined && readId(params.galleryId) === null;
  const leave = () => back(galleryId ? `/communities/${galleryId}` : "/posts");
  const search = () => to(withQuery("/search", { scope, galleryId }));
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={leave} onSearch={search} />
        <div className={sharedStyles.screenBody}>
          {postId === null || invalidGalleryId ? (
            <>
              <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
              {nativeApp() && <NativeInvalidPostBridge onBack={leave} onSearch={search} />}
            </>
          ) : (
            <PostCommentsScreen
              key={postId}
              postId={postId}
              onHidden={leave}
              onProfile={(id) => to(`/users/${id}`)}
              onBack={leave}
              onSearch={search}
            />
          )}
        </div>

        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
