import { NotificationPanel } from "../notification-panel";
import { NativeNotificationsBridge } from "../native-notifications-bridge";
import { nativeApp } from "@/lib/native-app";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
export default function NotificationsPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const search = () => to(withQuery("/search", { scope, galleryId }));
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onSearch={search} onBack={() => back("/")} />
        {/* The web inbox is an aria-modal dialog, which would hide the native screen; the app draws it natively instead. */}
        <div className={sharedStyles.screenBody}>
          {nativeApp() ? <NativeNotificationsBridge onSearch={search} /> : <NotificationPanel />}
        </div>
      </div>
    </DesignViewport>
  );
}
