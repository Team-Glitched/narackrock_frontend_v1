import { DesignViewport } from "@/components/design-viewport";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
import { CommunityManagementContent } from "@/features/community/community-management-content";
import { PageState } from "@/components/page-state";
import { NativeCommunityAdminBridge } from "@/features/admin/native-admin-bridge";
import { nativeApp } from "@/lib/native-app";

export default function CommunityMembersPage() {
  const { to, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "posts", Boolean(galleryId));
  const invalidGalleryId = readId(params.galleryId) === null;
  if (nativeApp())
    return (
      <>
        <NativeCommunityAdminBridge
          galleryId={galleryId}
          invalid={invalidGalleryId}
          onSearch={() => to(withQuery("/search", { scope, galleryId }))}
        />
        <Footer activeTab="social" />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <div className="min-h-0 flex-1 overflow-hidden pb-2">
          {invalidGalleryId ? (
            <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
          ) : (
            <CommunityManagementContent galleryId={galleryId} />
          )}
        </div>
        <Footer activeTab="social" />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
