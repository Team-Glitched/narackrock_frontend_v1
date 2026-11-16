import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { resolveSearchScope } from "@/features/search/search-scope";
import { creationTarget } from "@/features/navigation/creation-target";
import NotFoundPage from "@/features/navigation/pages/not-found-page";
import { sharedStyles } from "@/styles/shared.styles";
import { FriendsListScreen, type FriendsListKind } from "@/features/social/friends-screen";
import { nativeApp } from "@/lib/native-app";
import { NativeFriendsListBridge } from "@/features/social/native-social-bridge";

const kinds: readonly FriendsListKind[] = ["mutual", "recommendations", "requests"];

/** `/friends/:list`: the full 맞팔로우, 팔로우 추천 or 팔로우 요청 list opened from the friends tab. */
export default function FriendsListPage() {
  const { to, back, params, query, currentPath } = useUrlNavigation();
  const kind = kinds.find((value) => value === params.list);
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "people", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  if (!kind) return <NotFoundPage />;
  const search = () => to(withQuery("/search", { scope, galleryId }));
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={() => back("/friends")} onSearch={search} />
        <div className={sharedStyles.screenBody}>
          <FriendsListScreen
            kind={kind}
            onProfile={(id) => to(`/users/${id}`)}
            onChat={(id) => to(`/chat?userId=${id}`)}
          />
          {nativeApp() && (
            <NativeFriendsListBridge
              kind={kind}
              onBack={() => back("/friends")}
              onSearch={search}
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
