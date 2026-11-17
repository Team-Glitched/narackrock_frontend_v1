import { SavedScreen } from "@/features/saved/saved-screen";
import { NativeSavedBridge } from "@/features/saved/native-saved-bridge";
import { nativeApp } from "@/lib/native-app";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { creationTarget } from "@/features/navigation/creation-target";
import { resolveSearchScope } from "@/features/search/search-scope";
import { readId, withQuery } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";

export default function SavedPage() {
  const { to, back, params, query, currentPath } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  const search = () => to(withQuery("/search", { scope, galleryId }));
  const open = {
    onOpenPost: (id: number) => to(`/posts/${id}`),
    onOpenSong: (id: number) => to(`/abyss/${id}`),
  };
  if (nativeApp())
    return (
      <>
        <NativeSavedBridge {...open} onSearch={search} onBack={() => back("/settings")} />
        <Footer
          activeTab={null}
          createLabel={target.label}
          onCreate={() =>
            to(
              target.path,
              target.path === "/studio/new"
                ? {
                    state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
                  }
                : undefined,
            )
          }
        />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header
          onBack={() => back("/settings")}
          onSettings={() => to("/settings")}
          onSearch={search}
        />
        <div className={sharedStyles.screenBody}>
          <SavedScreen {...open} />
        </div>
        <Footer
          activeTab={null}
          createLabel={target.label}
          onCreate={() =>
            to(
              target.path,
              target.path === "/studio/new"
                ? {
                    state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
                  }
                : undefined,
            )
          }
        />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
