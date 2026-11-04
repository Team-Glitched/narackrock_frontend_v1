import { AbyssScreen } from "@/features/abyss/abyss-screen";
import { useAbyssPlaybackPreferences } from "@/features/abyss/playback-preferences";
import { DesignViewport } from "@/components/ui/design-viewport";
import { PageState } from "@/components/ui/page-state";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { creationTarget } from "@/features/navigation/creation-target";
import { resolveSearchScope } from "@/features/search/search-scope";
import { readId, withQuery } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";

export default function AbyssPage() {
  const { to, back, params, query, currentPath, state } = useUrlNavigation();
  const { muted, setMuted } = useAbyssPlaybackPreferences();
  const shortId = readId(params.shortId);
  const invalidId = params.shortId !== undefined && shortId === null;
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header abyss muted={muted} onToggleMute={() => setMuted((value) => !value)}
          onBack={() => back("/")} onSearch={() => to(withQuery("/search", { scope, galleryId }))} />
        <div className={sharedStyles.screenBody}>
          {invalidId ? <PageState error>올바르지 않은 페이지 주소입니다.</PageState> : (
            <AbyssScreen
              onProfile={(id) => to(`/users/${id}`)}
              muted={muted}
              initialShortId={shortId}
              onRememberShort={(id) => {
                if (id !== shortId) to(`/abyss/${id}`, { replace: true, state });
              }}
              onJoin={(id) => to(`/studio/shorts/${id}`, {
                state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
              })}
            />
          )}
        </div>
        <Footer activeTab="abyss" createLabel={target.label} onCreate={() => to(target.path, target.path === "/studio/new" ? {
          state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
        } : undefined)} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
