import { Navigate } from "react-router";
import { HomeScreen } from "@/features/home/home-screens";
import { NativeHomeBridge } from "@/features/home/native-home-bridge";
import { nativeApp } from "@/lib/native-app";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { resolveSearchScope } from "@/features/search/search-scope";
import { readId, studioPath, withQuery } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";

export default function HomePage() {
  const { to, params, query, currentPath } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const sharedShortId = readId(query.get("short"));
  if (sharedShortId) return <Navigate replace to={`/abyss/${sharedShortId}`} />;
  const search = () => to(withQuery("/search", { scope, galleryId }));
  const screen = {
    onOpenPosts: () => to("/posts"),
    onOpenWorkspace: () => to("/workspace"),
    onStartSong: () =>
      to("/studio/new", {
        state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
      }),
    onOpenPost: (id: number) => to(`/posts/${id}`),
    onOpenShort: (id: number) => to(`/abyss/${id}`),
    onShowSongs: (kind: string) => to(`/charts?kind=${kind}`),
    onResume: (id: number, shortId: number | null) =>
      to(studioPath(id, shortId), {
        state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
      }),
  };
  if (nativeApp())
    return (
      <>
        <NativeHomeBridge {...screen} onSearch={search} />
        <Footer activeTab="home" />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header showChat onSearch={search} />
        <div className={sharedStyles.screenBody}>
          <HomeScreen {...screen} />
        </div>
        <Footer activeTab="home" />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
