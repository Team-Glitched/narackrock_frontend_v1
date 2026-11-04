import { NotificationPanel } from "../notification-panel";
import { DesignViewport } from "@/components/ui/design-viewport";
import { Header } from "@/features/navigation/header";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
export default function NotificationsPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onSearch={() => to(withQuery("/search", { scope, galleryId }))} onBack={() => back("/")} />
        <div className={sharedStyles.screenBody}><NotificationPanel /></div>
      </div>
    </DesignViewport>
  );
}
