import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
import { AdminReviewScreen } from "@/features/admin/admin-screens";
import { NativeAdminReviewBridge } from "@/features/admin/native-admin-bridge";
import { nativeApp } from "@/lib/native-app";

export default function AdminPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const onSearch = () => to(withQuery("/search", { scope, galleryId }));
  if (nativeApp())
    return (
      <>
        <NativeAdminReviewBridge onBack={() => back("/settings")} onSearch={onSearch} />
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={() => back("/settings")} onSearch={onSearch} />
        <div className={sharedStyles.screenBody}>
          <AdminReviewScreen />
        </div>
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
