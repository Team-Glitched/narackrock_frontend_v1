import { AbyssScreen } from "@/features/abyss/abyss-screen";
import { NativeInvalidAbyssBridge } from "@/features/abyss/native-abyss-bridge";
import { useAbyssPlaybackPreferences } from "@/features/abyss/playback-preferences";
import { DesignViewport } from "@/components/design-viewport";
import { PageState } from "@/components/page-state";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { creationTarget } from "@/features/navigation/creation-target";
import { resolveSearchScope } from "@/features/search/search-scope";
import { readId, withQuery } from "@/features/navigation/paths";
import { nativeApp } from "@/lib/native-app";
import { sharedStyles } from "@/styles/shared.styles";

export default function AbyssPage() {
  const { to, back, params, query, currentPath, state } = useUrlNavigation();
  const { muted, setMuted } = useAbyssPlaybackPreferences();
  const shortId = readId(params.shortId);
  const invalidId = params.shortId !== undefined && shortId === null;
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  const search = () => to(withQuery("/search", { scope, galleryId }));
  const inApp = nativeApp() !== null;
  const footer = (
    <Footer
      activeTab="abyss"
      createLabel={target.label}
      onCreate={() =>
        to(
          target.path,
          target.path === "/studio/new"
            ? { state: { studioFrom: currentPath, studioIndex: window.history.state?.idx } }
            : undefined,
        )
      }
    />
  );
  if (inApp)
    return invalidId ? (
      <>
        <NativeInvalidAbyssBridge onSearch={search} />
        {footer}
      </>
    ) : (
      <AbyssScreen
        nativeScreen={{ onSearch: search, footer }}
        onProfile={(id) => to(`/users/${id}`)}
        muted={muted}
        initialShortId={shortId}
        onRememberShort={(id) => {
          if (id !== shortId) to(`/abyss/${id}`, { replace: true, state });
        }}
        onJoin={(id) =>
          to(`/studio/shorts/${id}`, {
            state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
          })
        }
        onOpenStudio={(id) =>
          to(`/studio/${id}?view=approved`, {
            state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
          })
        }
        onOpenRequest={(projectId, contributionId) =>
          to(
            contributionId == null
              ? "/submissions"
              : `/submissions/${contributionId}?projectId=${projectId}`,
          )
        }
      />
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header
          abyss
          muted={muted}
          onToggleMute={() => setMuted((value) => !value)}
          onBack={() => back("/")}
          onSearch={search}
        />
        <div className={sharedStyles.screenBody}>
          {invalidId ? (
            <>
              <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
            </>
          ) : (
            <AbyssScreen
              onProfile={(id) => to(`/users/${id}`)}
              muted={muted}
              initialShortId={shortId}
              onRememberShort={(id) => {
                if (id !== shortId) to(`/abyss/${id}`, { replace: true, state });
              }}
              onJoin={(id) =>
                to(`/studio/shorts/${id}`, {
                  state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
                })
              }
              onOpenStudio={(projectId) =>
                to(`/studio/${projectId}?view=approved`, {
                  state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
                })
              }
              onOpenRequest={(projectId, contributionId) =>
                to(
                  contributionId == null
                    ? "/submissions"
                    : `/submissions/${contributionId}?projectId=${projectId}`,
                )
              }
            />
          )}
        </div>
        {footer}
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
