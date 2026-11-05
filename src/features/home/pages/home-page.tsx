import { Navigate } from "react-router";
import { HomeScreen } from "@/features/home/home-screens";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { creationTarget } from "@/features/navigation/creation-target";
import { resolveSearchScope } from "@/features/search/search-scope";
import { readId, studioPath, withQuery } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";

export default function HomePage() {
  const { to, params, query, currentPath } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  const sharedShortId = readId(query.get("short"));
  if (sharedShortId) return <Navigate replace to={`/abyss/${sharedShortId}`} />;
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onSearch={() => to(withQuery("/search", { scope, galleryId }))} />
        <div className={sharedStyles.screenBody}>
          <HomeScreen
            onOpenPosts={() => to("/posts")}
            onOpenWorkspace={() => to("/workspace")}
            onStartSong={() => to("/studio/new", {
              state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
            })}
            onOpenPost={(id) => to(`/posts/${id}`)}
            onOpenShort={(id) => to(`/abyss/${id}`)}
            onShowSongs={(kind) => to(`/charts?kind=${kind}`)}
            onResume={(id, shortId) => to(studioPath(id, shortId), {
              state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
            })}
          />
        </div>
        <Footer activeTab="home" createLabel={target.label} onCreate={() => to(target.path, target.path === "/studio/new" ? {
          state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
        } : undefined)} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
