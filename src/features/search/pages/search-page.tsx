import { useLocation, useSearchParams } from "react-router";
import { ScopedSearch } from "@/features/search/search-screen";
import { NativeSearchBridge } from "@/features/search/native-search-bridge";
import { nativeApp } from "@/lib/native-app";
import { useRouteCommunity } from "@/features/community/use-route-community";
import { DesignViewport } from "@/components/design-viewport";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { resolveSearchScope } from "@/features/search/search-scope";
import { readId, searchFallbackPath } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";

export default function SearchPage() {
  const { to, back, params, query } = useUrlNavigation();
  const [, setQuery] = useSearchParams();
  const location = useLocation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
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
    onBack: () => back(searchFallbackPath(scope, galleryId)),
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
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <div className="min-h-0 flex-1 overflow-hidden pb-2">
          <ScopedSearch
            {...search}
            onCommunity={(value) => to(`/communities/${value.galleryId}`)}
          />
        </div>
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
