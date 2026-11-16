import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { creationTarget } from "@/features/navigation/creation-target";
import { sharedStyles } from "@/styles/shared.styles";
import { CommunityManagementContent } from "@/features/community/community-management-content";
import { NativeCommunityAdminBridge } from "@/features/admin/native-admin-bridge";
import { nativeApp } from "@/lib/native-app";

export default function OwnedCommunitiesPage() {
  const { to, back, params, query, currentPath } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "posts", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  const onBack = () => back("/communities");
  const onSearch = () => to(withQuery("/search", { scope, galleryId }));
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={onBack} onSearch={onSearch} />
        <div className={sharedStyles.screenBody}>
          <CommunityManagementContent galleryId={null} members={false} />
          {nativeApp() && (
            <NativeCommunityAdminBridge
              galleryId={null}
              members={false}
              invalid={false}
              onBack={onBack}
              onSearch={onSearch}
            />
          )}
        </div>
        <Footer
          activeTab="social"
          onCreate={() =>
            to(
              target.path,
              target.path === "/studio/new"
                ? {
                    state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
                  }
                : undefined,
            )
          }
          createLabel={target.label}
        />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
