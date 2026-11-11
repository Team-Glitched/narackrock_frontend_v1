import { NewProject } from "@/features/composition/new-project-screen";
import { safeReturnPath, readId, withQuery } from "@/features/navigation/paths";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import type { StudioLocationState } from "@/features/composition/studio-location-state";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
import { useCurrentUserId } from "@/features/auth/use-current-user";
export default function StudioNewPage() {
  const userId = useCurrentUserId();
  const { to, back, state, params, query } = useUrlNavigation<StudioLocationState>();
  const studioFrom = state.studioFrom ?? safeReturnPath(state.from);
  const studioState = { studioFrom, studioIndex: state.studioIndex, inbox: state.inbox };
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onSearch={() => to(withQuery("/search", { scope, galleryId }))} onBack={() => back("/")} />
        <div className={sharedStyles.screenBody}>
          <NewProject
            key={userId ?? "guest"}
            userId={userId}
            onBack={() => back("/")}
            onCreated={(id) => to(`/studio/${id}/layers/new`, { state: studioState })}
            onResume={(id) => to(`/studio/${id}`, { state: studioState })}
          />
        </div>
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
