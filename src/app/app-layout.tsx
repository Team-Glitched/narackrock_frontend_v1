import { useEffect } from "react";
import { Outlet, useLocation, useSearchParams } from "react-router";
import { DesignViewport } from "@/components/app/design-viewport";
import { Header, Footer } from "@/components/app/shared";
import { PostCommunityPicker } from "@/features/community/post-community-picker";
import { useGalleries } from "@/features/community/use-galleries";
import { DEFAULT_GALLERY_ID } from "@/lib/api/community";
import { useAppSession } from "@/app/session";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { creationForView, creationLabels } from "@/features/navigation/context-actions";
import { readId } from "@/features/navigation/paths";
import { routeBackPath } from "@/features/navigation/route-back";
import { useWebMcpNavigation } from "@/hooks/use-webmcp-navigation";
import NotificationsPage from "@/features/notifications/pages/notifications-page";
import { PageState } from "@/components/app/page-state";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";

function PostTargetSelector() {
  const galleries = useGalleries(0);
  const [query, setQuery] = useSearchParams();
  const location = useLocation();
  return (
    <PostCommunityPicker
      galleries={galleries}
      value={readId(query.get("galleryId")) ?? DEFAULT_GALLERY_ID}
      onChange={(id) =>
        setQuery(
          (previous) => {
            const next = new URLSearchParams(previous);
            next.set("galleryId", String(id));
            return next;
          },
          { replace: true, state: location.state },
        )
      }
    />
  );
}

export default function AppLayout() {
  const nav = useAppNavigation();
  const session = useAppSession();
  const { page, params, query } = nav;
  const { go } = nav;
  useWebMcpNavigation(go);
  useEffect(() => {
    document.title = page.title ? `${page.title} | Narackrock` : "Narackrock — Make it heard";
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", "함께 만들고 발견하는 음악 커뮤니티 Narackrock");
  }, [page.title]);
  const invalidId = Object.entries(params).some(
    ([key, value]) => key.endsWith("Id") && readId(value) === null,
  );
  const content = invalidId ? (
    <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
  ) : (
    <Outlet />
  );
  if (page.layout === "studio") return <DesignViewport landscape>{content}</DesignViewport>;
  const sourcePianoMode = page.id === "createSource" && query.get("stage") === "note";
  const profileUserId = readId(params.userId);
  const hasBack = Boolean(page.back) || (page.id === "createSource" && query.has("stage"));
  const fallback = routeBackPath(page, params, query);
  return (
    <DesignViewport landscape={sourcePianoMode}>
      <div
        className={cn(
          sharedStyles.phoneFrame,
          sourcePianoMode && sharedStyles.phoneFrameSourcePiano,
        )}
      >
        {!page.hideHeader && !sourcePianoMode && (
          <Header
            communitySelector={page.id === "createPost" ? <PostTargetSelector /> : undefined}
            onSettings={
              (profileUserId === null || profileUserId === session.currentUserId) &&
              ["profile", "edit", "saved"].includes(page.view)
                ? () => nav.to("/settings")
                : undefined
            }
            abyss={page.view === "abyss"}
            muted={session.abyssMuted}
            onToggleMute={() => session.setAbyssMuted((value) => !value)}
            onHome={() => nav.to("/")}
            profileImageUrl={session.headerProfileImageUrl}
            onBack={hasBack ? () => nav.back(fallback) : undefined}
            onSearch={nav.openSearch}
            onProfile={() => nav.go(session.currentUserId === null ? "login" : "profile")}
            onNotifications={nav.openNotifications}
          />
        )}
        <div className={sharedStyles.screenBody}>{content}</div>
        {!page.hideFooter && !sourcePianoMode && (
          <Footer
            view={page.view === "communityAdmin" || page.view === "joined" ? "social" : page.view}
            go={nav.go}
            onCreate={nav.openCreate}
            createLabel={creationLabels[creationForView(page.view, nav.scope)]}
          />
        )}
        {query.get("notifications") === "1" && page.id !== "notifications" && (
          <NotificationsPage overlay />
        )}
      </div>
    </DesignViewport>
  );
}
