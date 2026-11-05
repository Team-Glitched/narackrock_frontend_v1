import { EditProfileScreen } from "@/features/profile/profile-screens";
import { useAuthSession } from "@/features/auth/auth-session";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { creationTarget } from "@/features/navigation/creation-target";
import { resolveSearchScope } from "@/features/search/search-scope";
import { readId, withQuery } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";

export default function EditProfilePage() {
  const { refreshProfile } = useAuthSession();
  const { to, back, params, query, currentPath } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "people", Boolean(galleryId));
  const target = creationTarget("songs");
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={() => back("/profile")} onSettings={() => to("/settings")}
          onSearch={() => to(withQuery("/search", { scope, galleryId }))} />
        <div className={sharedStyles.screenBody}>
          <EditProfileScreen onSaved={() => {
            refreshProfile();
            back("/profile");
          }} />
        </div>
        <Footer activeTab={null} createLabel={target.label} onCreate={() => to(target.path, {
          state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
        })} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
