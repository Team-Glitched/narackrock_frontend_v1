import { OpensourceScreen } from "@/features/sources/source-screens";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { creationTarget } from "@/features/navigation/creation-target";
import { resolveSearchScope } from "@/features/search/search-scope";
import { readId, withQuery } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { apiOrigin } from "@/lib/api/client";
import { SavedOpenSources } from "@/features/sources/saved-open-sources";
import { SourcePublications } from "@/features/sources/source-publications";
import { workspaceStyles } from "@/styles/workspace.styles";


export default function SourcesPage() {
  const { to, params, query, currentPath } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "sources", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  const userId = useCurrentUserId();
  const tab = query.get("tab") === "mine" ? "mine" : query.get("tab") === "saved" ? "saved" : "feed";
  function selectTab(value: string) {
    const next = new URLSearchParams(query);
    if (value === "feed") next.delete("tab");
    else next.set("tab", value);
    to(`/sources${next.size ? `?${next}` : ""}`);
  }
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onSearch={() => to(withQuery("/search", { scope, galleryId }))} />
        <div className={sharedStyles.screenBody}>
          <div className="flex h-full min-h-0 flex-col">
            <nav className="flex shrink-0 flex-wrap gap-2 border-b border-app-line px-5 py-3" aria-label="샘플 메뉴">
              {([["feed", "탐색"], ["saved", "보관함"], ["mine", "내 등록"]] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={tab === value} className="min-h-11 rounded-xl px-3 text-body aria-pressed:bg-app-primary" onClick={() => selectTab(value)}>
                  {label}
                </button>
              ))}
              <button type="button" className="min-h-11 rounded-xl px-3 text-body" onClick={() => to("/sources/new")}>등록</button>
            </nav>
            <div key={JSON.stringify([apiOrigin(), userId, tab])} className="min-h-0 flex-1 overflow-hidden">
              {tab === "feed" ? (
                <OpensourceScreen
                  onOpen={(id, comments) => to(comments ? `/sources/${id}/comments` : `/sources/${id}`)}
                  onProfile={(id) => to(`/users/${id}`)}
                />
              ) : tab === "saved" ? (
                <section className={`${workspaceStyles.workspacePage} ${sharedStyles.scrollContent}`}>
                  <h1>샘플 보관함</h1>
                  <SavedOpenSources query="" onOpen={(id) => to(`/sources/${id}`)} />
                </section>
              ) : (
                <SourcePublications onOpen={(id) => to(`/sources/${id}`)} />
              )}
            </div>
          </div>
        </div>
        <Footer activeTab="opensource" createLabel={target.label} onCreate={() => to(target.path, target.path === "/studio/new" ? {
          state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
        } : undefined)} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
