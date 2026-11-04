import { OpensourceDetailScreen } from "@/features/sources/source-screens";
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

export default function SourcePage() {
  const { to, back, params, query, currentPath } = useUrlNavigation();
  const comments = currentPath.split(/[?#]/)[0].endsWith("/comments");
  const sourceId = readId(params.sourceId);
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "sources", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={() => back("/sources")} onSearch={() => to(withQuery("/search", { scope, galleryId }))} />
        <div className={sharedStyles.screenBody}>
          {sourceId === null ? (
            <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
          ) : (
            <OpensourceDetailScreen sourceId={sourceId} focusComments={comments} onProfile={(id) => to(`/users/${id}`)} />
          )}
        </div>
        <Footer activeTab="opensource" createLabel={target.label} onCreate={() => to(target.path, target.path === "/studio/new" ? {
          state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
        } : undefined)} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
