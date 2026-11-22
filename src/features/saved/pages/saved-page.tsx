import { SavedScreen } from "@/features/saved/saved-screen";
import { NativeSavedBridge } from "@/features/saved/native-saved-bridge";
import { nativeApp } from "@/lib/native-app";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { resolveSearchScope } from "@/features/search/search-scope";
import { readId, withQuery } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";

export default function SavedPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const search = () => to(withQuery("/search", { scope, galleryId }));
  const open = {
    onOpenPost: (id: number) => to(`/posts/${id}`),
    onOpenSong: (id: number) => to(`/abyss/${id}`),
  };
  if (nativeApp())
    return (
      <>
        <NativeSavedBridge {...open} onSearch={search} onBack={() => back("/settings")} />
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={() => back("/settings")} onSearch={search} />
        <div className={sharedStyles.screenBody}>
          <SavedScreen {...open} />
        </div>
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
