import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { ContextualCreate, contextualCreateArea } from "@/features/navigation/contextual-create";
import { sharedStyles } from "@/styles/shared.styles";
import { CommunityScreen } from "@/features/social/social-screen";

export default function CommunitiesPage() {
  const { to, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "communities", Boolean(galleryId));
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header showChat onSearch={() => to(withQuery("/search", { scope, galleryId }))} />
        <div className={contextualCreateArea}>
          <CommunityScreen
            tab="community"
            onProfile={(id) => to(`/users/${id}`)}
            onChat={(id) => to(`/chat?userId=${id}`)}
            onJoined={() => to("/communities/joined")}
            onTabChange={(value) =>
              to(value === "posts" ? "/social" : value === "community" ? "/communities" : "/friends")
            }
            onComments={(id) => to(`/posts/${id}`)}
            onOpenCommunity={(community) => to(`/communities/${community.galleryId}`)}
          />
          <ContextualCreate scope="communities" />
        </div>
        <Footer activeTab="social" />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
