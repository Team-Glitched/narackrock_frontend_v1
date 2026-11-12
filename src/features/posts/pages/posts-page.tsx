import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { ContextualCreate, contextualCreateArea } from "@/features/navigation/contextual-create";
import { sharedStyles } from "@/styles/shared.styles";
import { PostsScreen } from "@/features/posts/post-list";

export default function PostsPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "posts", Boolean(galleryId));
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header
          onBack={() => back("/")}
          onSearch={() => to(withQuery("/search", { scope, galleryId }))}
        />
        <div className={contextualCreateArea}>
          <PostsScreen onOpenPost={(id) => to(`/posts/${id}`)} />
          <ContextualCreate scope="posts" galleryId={galleryId} />
        </div>
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
