import {
  NewProject,
  useNewProject,
  type NewProjectOptions,
} from "@/features/composition/new-project-screen";
import { NativeStudioNewBridge } from "@/features/composition/native-studio-pages-bridge";
import { safeReturnPath, readId, withQuery } from "@/features/navigation/paths";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import type { StudioLocationState } from "@/features/composition/studio-location-state";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { nativeApp } from "@/lib/native-app";

/** One form per account: the web form, and the app's native screen over the same state. */
function NewProjectForm({
  onBack,
  onSearch,
  onMigration,
  ...options
}: NewProjectOptions & { onBack: () => void; onSearch: () => void; onMigration: () => void }) {
  const project = useNewProject(options);
  return nativeApp() ? (
    <NativeStudioNewBridge
      project={project}
      onBack={onBack}
      onSearch={onSearch}
      onMigration={onMigration}
    />
  ) : (
    <NewProject project={project} />
  );
}

export default function StudioNewPage() {
  const userId = useCurrentUserId();
  const { to, back, state, params, query } = useUrlNavigation<StudioLocationState>();
  const studioFrom = state.studioFrom ?? safeReturnPath(state.from);
  const studioState = { studioFrom, studioIndex: state.studioIndex, inbox: state.inbox };
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const search = () => to(withQuery("/search", { scope, galleryId }));
  const form = (
    <NewProjectForm
      key={userId ?? "guest"}
      userId={userId}
      onBack={() => back("/")}
      onSearch={search}
      onMigration={() => to("/settings?migration=1")}
      onCreated={(id) => to(`/studio/${id}/layers/new`, { state: studioState })}
      onResume={(id) => to(`/studio/${id}`, { state: studioState })}
    />
  );
  if (nativeApp())
    return (
      <>
        {form}
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header minimal onSearch={search} onBack={() => back("/")} />
        <div className={sharedStyles.screenBody}>{form}</div>
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
