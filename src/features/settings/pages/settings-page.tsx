import { logout } from "@/lib/api/auth";
import { SettingsScreen } from "@/features/settings/settings-screen";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { sharedStyles } from "@/styles/shared.styles";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { creationTarget } from "@/features/navigation/creation-target";
import { MigrationScreen } from "@/features/migration/migration-screen";
export default function SettingsPage() {
  const { to, back, params, query, currentPath } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header
          onSearch={() => to(withQuery("/search", { scope, galleryId }))}
          onBack={() => back("/profile")}
        />
        <div className={sharedStyles.screenBody}>
          {query.get("migration") === "1" ? (
            <MigrationScreen />
          ) : (
            <>
              <SettingsScreen
                onNavigate={to}
                onLogout={() => {
                  logout();
                  to("/login", { replace: true });
                }}
              />
              <button onClick={() => to("/settings?migration=1")}>
                이 브라우저 데이터 이관·복구
              </button>
            </>
          )}
        </div>
        <Footer
          activeTab={null}
          createLabel={target.label}
          onCreate={() =>
            to(
              target.path,
              target.path === "/studio/new"
                ? { state: { studioFrom: currentPath, studioIndex: window.history.state?.idx } }
                : undefined,
            )
          }
        />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
