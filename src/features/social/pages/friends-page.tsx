import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { creationTarget } from "@/features/navigation/creation-target";
import { sharedStyles } from "@/styles/shared.styles";
import { CommunityScreen } from "@/features/social/social-screen";

export default function FriendsPage() {
  const { to, params, query, currentPath } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "people", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header showChat onSearch={() => to(withQuery("/search", { scope, galleryId }))} />
        <div className={sharedStyles.screenBody}>
          <CommunityScreen
            tab="friends"
            onOpenFriendsList={(kind) => to(`/friends/${kind}`)}
            onProfile={(id) => to(`/users/${id}`)}
            onChat={(id) => to(`/chat?userId=${id}`)}
            onJoined={() => to("/communities/joined")}
            onTabChange={(value) =>
              to(value === "posts" ? "/social" : value === "community" ? "/communities" : "/friends")
            }
            onComments={(id) => to(`/posts/${id}`)}
            onOpenCommunity={(community) => to(`/communities/${community.galleryId}`)}
          />
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
