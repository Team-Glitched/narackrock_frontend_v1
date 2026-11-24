import { useNavigate } from "react-router";
import { logout } from "@/lib/api/auth";
import { nativeApp } from "@/lib/native-app";
import { SettingsScreen } from "@/features/settings/settings-screen";
import { NativeSettingsBridge } from "@/features/settings/native-settings-bridge";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { sharedStyles } from "@/styles/shared.styles";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { MigrationScreen } from "@/features/migration/migration-screen";
export default function SettingsPage() {
  const { to, back, params, query } = useUrlNavigation();
  const navigate = useNavigate();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const search = () => to(withQuery("/search", { scope, galleryId }));
  const signOut = () => {
    // Leave the protected page in the same render before the session clears; a transition here would
    // first re-render /settings signed out and flash the login confirmation.
    navigate("/login", { replace: true, flushSync: true });
    logout();
  };
  if (nativeApp())
    return (
      <>
        <NativeSettingsBridge
          onNavigate={to}
          onLogout={signOut}
          onSearch={search}
          onBack={() => back("/profile")}
        />
        {query.get("migration") === "1" && <MigrationScreen />}
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onSearch={search} onBack={() => back("/profile")} />
        <div className={sharedStyles.screenBody}>
          {query.get("migration") === "1" ? (
            <MigrationScreen />
          ) : (
            <SettingsScreen onNavigate={to} onLogout={signOut} />
          )}
        </div>
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
