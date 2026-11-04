import { DesignViewport } from "@/components/ui/design-viewport";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { creationTarget } from "@/features/navigation/creation-target";
import { sharedStyles } from "@/styles/shared.styles";
import { CommunityManagementContent } from "@/features/community/community-management-content";
import { PageState } from "@/components/ui/page-state";

export default function CommunityMembersPage() {
  const { to, params, query, currentPath } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "posts", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  const invalidGalleryId = readId(params.galleryId) === null;
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>

        <div className={sharedStyles.screenBody}>
          {invalidGalleryId ? (
            <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
          ) : (
            <CommunityManagementContent galleryId={galleryId} members={true} />
          )}
        </div>
        <Footer
          activeTab="social"
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
