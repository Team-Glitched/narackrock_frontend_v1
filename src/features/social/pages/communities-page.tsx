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
import { nativeApp } from "@/lib/native-app";
import { NativeSocialCommunitiesBridge } from "@/features/social/native-social-bridge";

export default function CommunitiesPage() {
  const { to, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "communities", Boolean(galleryId));
  const search = () => to(withQuery("/search", { scope, galleryId }));
  if (nativeApp())
    return (
      <>
        <NativeSocialCommunitiesBridge onSearch={search} />
        <Footer activeTab="social" />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header showChat onSearch={search} />
        <div className={contextualCreateArea}>
          <CommunityScreen
            tab="community"
            onProfile={(id) => to(`/users/${id}`)}
            onChat={(id) => to(`/chat?userId=${id}`)}
            onJoined={() => to("/communities/joined")}
            onTabChange={(value) =>
              to(
                value === "posts" ? "/social" : value === "community" ? "/communities" : "/friends",
              )
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
