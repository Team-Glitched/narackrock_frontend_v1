import { DesignViewport } from "@/components/ui/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { creationTarget } from "@/features/navigation/creation-target";
import { sharedStyles } from "@/styles/shared.styles";
import { AdminReviewScreen } from "@/features/admin/admin-screens";

export default function AdminPage() {
  const { to, back, params, query, currentPath } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header
          onBack={() => back("/settings")}
          onSearch={() => to(withQuery("/search", { scope, galleryId }))}
        />
        <div className={sharedStyles.screenBody}>
          <AdminReviewScreen />
        </div>
        <Footer
          activeTab={null}
          onCreate={() => to(target.path, target.path === "/studio/new" ? {
            state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
          } : undefined)}
          createLabel={target.label}
        />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
