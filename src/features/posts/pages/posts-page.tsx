import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { creationTarget } from "@/features/navigation/creation-target";
import { nativeApp } from "@/lib/native-app";
import { NativePostsBridge } from "@/features/posts/native-posts-bridge";
import { resolveSearchScope } from "@/features/search/search-scope";
import { ContextualCreate, contextualCreateArea } from "@/features/navigation/contextual-create";
import { sharedStyles } from "@/styles/shared.styles";
import { PostsScreen } from "@/features/posts/post-list";

export default function PostsPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "posts", Boolean(galleryId));
  const search = () => to(withQuery("/search", { scope, galleryId }));
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={() => back("/")} onSearch={search} />
        <div className={contextualCreateArea}>
          <PostsScreen onOpenPost={(id) => to(`/posts/${id}`)} />
          <ContextualCreate scope="posts" galleryId={galleryId} />
          {nativeApp() && (
            <NativePostsBridge
              onOpenPost={(id) => to(`/posts/${id}`)}
              onCreate={() => to(creationTarget("posts", galleryId).path)}
              onSearch={search}
              onBack={() => back("/")}
            />
          )}
        </div>
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
