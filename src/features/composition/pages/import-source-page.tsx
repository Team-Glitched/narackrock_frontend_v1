import { SourceLibraryContent } from "@/features/workspace/source-library-content";
import { PageState } from "@/components/page-state";
import { useRouteComposition } from "@/features/composition/use-route-composition";
import { readId, withQuery } from "@/features/navigation/paths";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { creationTarget } from "@/features/navigation/creation-target";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
export default function ImportSourcePage() {
  const route = useRouteComposition();
  const { to, back, params, query, currentPath } = route;
  const returnPath = route.trackId
    ? route.notesUrl({ trackId: route.trackId, clipId: route.clipId })
    : route.studioUrl;
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "sources", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  const onCreate = () => to(target.path, target.path === "/studio/new"
    ? { state: { studioFrom: currentPath, studioIndex: window.history.state?.idx } }
    : undefined);
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onSearch={() => to(withQuery("/search", { scope, galleryId }))} onBack={() => back(returnPath)} />
        <div className={sharedStyles.screenBody}>
          {route.projectId === null ? <PageState error>올바르지 않은 페이지 주소입니다.</PageState> : (
            <SourceLibraryContent importing />
          )}
        </div>
        <Footer activeTab={null} onCreate={onCreate} createLabel={target.label} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
