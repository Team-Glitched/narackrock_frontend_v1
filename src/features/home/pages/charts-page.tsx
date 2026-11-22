import { ChartsScreen, type MusicListTab, type SongChartKind } from "@/features/home/home-screens";
import { NativeChartsBridge } from "@/features/home/native-charts-bridge";
import { nativeApp } from "@/lib/native-app";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { resolveSearchScope } from "@/features/search/search-scope";
import { readId, withQuery } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";

export default function ChartsPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const value = query.get("kind");
  const kind: SongChartKind = value === "mine" || value === "recommended" ? value : "popular";
  const featuredUserId = readId(query.get("userId")) ?? undefined;
  const chart = {
    tab: (query.get("tab") === "featured"
      ? "featured"
      : query.get("tab") === "participated"
        ? "participated"
        : "authored") as MusicListTab,
    featuredUserId,
    onTabChange: (tab: MusicListTab) => {
      const next = new URLSearchParams(query);
      next.set("tab", tab);
      if (tab !== "featured") next.delete("userId");
      to(`/charts?${next}`, { replace: true });
    },
    onOpenShort: (id: number) => to(`/abyss/${id}`),
  };
  const backFallback = kind === "mine" && featuredUserId ? `/users/${featuredUserId}` : "/";
  const search = () => to(withQuery("/search", { scope, galleryId }));
  if (nativeApp())
    return (
      <>
        <NativeChartsBridge kind={kind} {...chart} onSearch={search} onBack={() => back(backFallback)} />
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={() => back(backFallback)} onSearch={search} />
        <div className={sharedStyles.screenBody}>
          <ChartsScreen kind={kind} {...chart} />
        </div>
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
