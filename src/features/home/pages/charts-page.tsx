import { ChartsScreen, type SongChartKind } from "@/features/home/home-screens";
import { DesignViewport } from "@/components/ui/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { creationTarget } from "@/features/navigation/creation-target";
import { resolveSearchScope } from "@/features/search/search-scope";
import { readId, withQuery } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";

export default function ChartsPage() {
  const { to, back, params, query, currentPath } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  const value = query.get("kind");
  const kind: SongChartKind = value === "mine" || value === "recommended" ? value : "popular";
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onBack={() => back("/")} onSearch={() => to(withQuery("/search", { scope, galleryId }))} />
        <div className={sharedStyles.screenBody}>
          <ChartsScreen kind={kind} onOpenShort={(id) => to(`/abyss/${id}`)} />
        </div>
        <Footer activeTab={null} createLabel={target.label} onCreate={() => to(target.path, target.path === "/studio/new" ? {
          state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
        } : undefined)} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
