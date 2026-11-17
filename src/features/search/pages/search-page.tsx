import { useLocation, useSearchParams } from "react-router";
import { ScopedSearch } from "@/features/search/search-screen";
import { NativeSearchBridge } from "@/features/search/native-search-bridge";
import { nativeApp } from "@/lib/native-app";
import { useRouteCommunity } from "@/features/community/use-route-community";
import { DesignViewport } from "@/components/design-viewport";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { creationTarget } from "@/features/navigation/creation-target";
import { resolveSearchScope } from "@/features/search/search-scope";
import { readId } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";

export default function SearchPage() {
  const { to, back, params, query, currentPath } = useUrlNavigation();
  const [, setQuery] = useSearchParams();
  const location = useLocation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  const result = useRouteCommunity(galleryId);
  const update = (key: string, value: string) =>
    setQuery(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true, state: location.state },
    );
  const community = galleryId
    ? { galleryId, name: result.status === "ready" ? result.community.name : "커뮤니티" }
    : null;
  const search = {
    scope,
    onScope: (value: string) => update("scope", value),
    query: query.get("q") ?? "",
    onQuery: (value: string) => update("q", value),
    community,
    onBack: () => back("/"),
    onPost: (id: number) =>
      to(galleryId ? `/communities/${galleryId}/posts/${id}` : `/posts/${id}`),
    onSong: (id: number) => to(`/abyss/${id}`),
    onSource: (id: number) => to(`/sources/${id}`),
    onProfile: (id: number) => to(`/users/${id}`),
  };
  if (nativeApp())
    return (
      <>
        <NativeSearchBridge {...search} onCommunity={(id) => to(`/communities/${id}`)} />
        <Footer
          activeTab={null}
          createLabel={target.label}
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
        />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <div className={sharedStyles.screenBody}>
          <ScopedSearch
            {...search}
            onCommunity={(value) => to(`/communities/${value.galleryId}`)}
          />
        </div>
        <Footer
          activeTab={null}
          createLabel={target.label}
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
        />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
