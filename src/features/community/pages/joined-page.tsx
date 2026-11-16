import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { creationTarget } from "@/features/navigation/creation-target";
import { sharedStyles } from "@/styles/shared.styles";
import { JoinedCommunitiesScreen } from "@/features/community/community-directory";
import { nativeApp } from "@/lib/native-app";
import { NativeJoinedBridge } from "@/features/community/native-community-bridge";

export default function JoinedPage() {
  const { to, back, params, query, currentPath } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "communities", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  const onBack = () => back("/communities");
  const onSearch = () => to(withQuery("/search", { scope, galleryId }));
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={onBack} onSearch={onSearch} />
        <div className={sharedStyles.screenBody}>
          <JoinedCommunitiesScreen
            onOpen={(community) => to(`/communities/${community.galleryId}`)}
          />
          {nativeApp() && (
            <NativeJoinedBridge
              onOpen={(id) => to(`/communities/${id}`)}
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
