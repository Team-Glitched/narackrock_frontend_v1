import { EditProfileScreen } from "@/features/profile/profile-screens";
import { NativeEditProfileBridge } from "@/features/profile/native-profile-bridge";
import { nativeApp } from "@/lib/native-app";
import { useAuthSession } from "@/features/auth/auth-session";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { resolveSearchScope } from "@/features/search/search-scope";
import { readId, withQuery } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";

export default function EditProfilePage() {
  const { refreshProfile } = useAuthSession();
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "people", Boolean(galleryId));
  const search = () => to(withQuery("/search", { scope, galleryId }));
  const saved = () => {
    refreshProfile();
    back("/profile");
  };
  if (nativeApp())
    return (
      <>
        <NativeEditProfileBridge
          onSaved={saved}
          onPrivacyPolicy={() => to("/privacy")}
          onSearch={search}
          onBack={() => back("/profile")}
        />
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={() => back("/profile")} onSearch={search} />
        <div className={sharedStyles.screenBody}>
          <EditProfileScreen onSaved={saved} />
        </div>
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
