import { useLocation, useSearchParams } from "react-router";
import { ScopedSearch } from "@/features/search/search-screen";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { useRouteCommunity } from "@/features/community/use-route-community";
export default function SearchPage() {
  const { to, back, scope, galleryId } = useAppNavigation();
  const [query, setQuery] = useSearchParams();
  const location = useLocation();
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
  return (
    <ScopedSearch
      scope={scope}
      onScope={(value) => update("scope", value)}
      query={query.get("q") ?? ""}
      onQuery={(value) => update("q", value)}
      community={
        galleryId
          ? { galleryId, name: result.status === "ready" ? result.community.name : "커뮤니티" }
          : null
      }
      onBack={() => back()}
      onPost={(id) => to(galleryId ? `/communities/${galleryId}/posts/${id}` : `/posts/${id}`)}
      onCommunity={(value) => to(`/communities/${value.galleryId}`)}
      onSong={(id) => to(`/abyss/${id}`)}
      onProfile={(id) => to(`/users/${id}`)}
    />
  );
}
