import { ProfileScreen } from "@/features/profile/profile-screens";
import { useAuthSession } from "@/features/auth/auth-session";
import { DesignViewport } from "@/components/design-viewport";
import { PageState } from "@/components/page-state";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { creationTarget } from "@/features/navigation/creation-target";
import { resolveSearchScope } from "@/features/search/search-scope";
import { readId, withQuery } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";

export default function ProfilePage() {
  const { to, back, params, query, currentPath } = useUrlNavigation();
  const { currentUserId } = useAuthSession();
  const userId = readId(params.userId);
  const invalidId = params.userId !== undefined && userId === null;
  const own = params.userId === undefined || (userId !== null && userId === currentUserId);
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "people", Boolean(galleryId));
  const target = creationTarget("songs");
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={() => back("/")} onSearch={() => to(withQuery("/search", { scope, galleryId }))}
          onSettings={own ? () => to("/settings") : undefined} />
        <div className={sharedStyles.screenBody}>
          {invalidId ? <PageState error>올바르지 않은 페이지 주소입니다.</PageState> : (
            <ProfileScreen
              key={userId ?? "me"}
              userId={userId ?? undefined}
              onEdit={() => to("/profile/edit")}
              onProfile={(id) => to(`/users/${id}`)}
              onOpenShort={(id) => to(`/abyss/${id}`)}
              onOpenPost={(id) => to(`/posts/${id}`)}
              onChat={(id) => to(`/chat?userId=${id}`)}
            />
          )}
        </div>
        <Footer activeTab={null} createLabel={target.label} onCreate={() => to(target.path, {
          state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
        })} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
