import { WorkspaceScreen } from "@/features/workspace/workspace-screens";
import { NativeWorkspaceBridge } from "@/features/workspace/native-workspace-bridge";
import { nativeApp } from "@/lib/native-app";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, studioPath, withQuery } from "@/features/navigation/paths";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { creationTarget } from "@/features/navigation/creation-target";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
export default function WorkspacePage() {
  const { to, back, params, query, currentPath } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  const onCreate = () =>
    to(
      target.path,
      target.path === "/studio/new"
        ? { state: { studioFrom: currentPath, studioIndex: window.history.state?.idx } }
        : undefined,
    );
  const search = () => to(withQuery("/search", { scope, galleryId }));
  const onStartSong = () =>
    to("/studio/new", {
      state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
    });
  const onResume = (id: number, shortId: number | null) =>
    to(studioPath(id, shortId, { view: "working" }), {
      state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
    });
  if (nativeApp())
    return (
      <>
        <NativeWorkspaceBridge
          onStartSong={onStartSong}
          onResume={onResume}
          onSearch={search}
          onBack={() => back("/settings")}
        />
        <Footer activeTab={null} onCreate={onCreate} createLabel={target.label} />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onSearch={search} onBack={() => back("/settings")} />
        <div className={sharedStyles.screenBody}>
          <WorkspaceScreen onStartSong={onStartSong} onResume={onResume} />
        </div>
        <Footer activeTab={null} onCreate={onCreate} createLabel={target.label} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
