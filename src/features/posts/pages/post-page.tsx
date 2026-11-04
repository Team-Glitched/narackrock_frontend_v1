import { DesignViewport } from "@/components/ui/design-viewport";
import { Header } from "@/features/navigation/header";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
import { PostCommentsScreen } from "@/features/posts/post-comments";
import { PageState } from "@/components/ui/page-state";

export default function PostPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "posts", Boolean(galleryId));
  const postId = readId(params.postId);
  const invalidGalleryId = params.galleryId !== undefined && readId(params.galleryId) === null;
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header
          onBack={() => back(galleryId ? `/communities/${galleryId}` : "/posts")}
          onSearch={() => to(withQuery("/search", { scope, galleryId }))}
        />
        <div className={sharedStyles.screenBody}>
          {postId === null || invalidGalleryId ? (
            <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
          ) : (
            <PostCommentsScreen
              key={postId}
              postId={postId}
              onHidden={() => back(galleryId ? `/communities/${galleryId}` : "/posts")}
              onProfile={(id) => to(`/users/${id}`)}
            />
          )}
        </div>

        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
