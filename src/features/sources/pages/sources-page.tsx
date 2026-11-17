import { OpensourceScreen } from "@/features/sources/source-screens";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { ContextualCreate, contextualCreateArea } from "@/features/navigation/contextual-create";
import { resolveSearchScope } from "@/features/search/search-scope";
import { readId, withQuery } from "@/features/navigation/paths";
import { sharedStyles } from "@/styles/shared.styles";
import { sourceStyles } from "@/styles/source.styles";
import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { apiOrigin } from "@/lib/api/client";
import { SavedOpenSources } from "@/features/sources/saved-open-sources";
import { SourcePublications } from "@/features/sources/source-publications";
import { workspaceStyles } from "@/styles/workspace.styles";
import { nativeApp } from "@/lib/native-app";
import { NativeSourcesBridge } from "../native-sources-bridge";

export default function SourcesPage() {
  const { to, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "sources", Boolean(galleryId));
  const userId = useCurrentUserId();
  const tab =
    query.get("tab") === "mine" ? "mine" : query.get("tab") === "saved" ? "saved" : "feed";
  function selectTab(value: string) {
    const next = new URLSearchParams(query);
    if (value === "feed") next.delete("tab");
    else next.set("tab", value);
    to(`/sources${next.size ? `?${next}` : ""}`);
  }
  if (nativeApp())
    return (
      <>
        <NativeSourcesBridge
          key={JSON.stringify([apiOrigin(), userId, tab])}
          tab={tab}
          nav={{
            onHome: () => to("/"),
            onTab: selectTab,
            onCreate: () => to("/sources/new"),
            onOpen: (id, comments) => to(comments ? `/sources/${id}/comments` : `/sources/${id}`),
            onProfile: (id) => to(`/users/${id}`),
            onSearch: () => to(withQuery("/search", { scope, galleryId })),
          }}
        />
        <Footer activeTab="opensource" />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onSearch={() => to(withQuery("/search", { scope, galleryId }))} />
        <div className={contextualCreateArea}>
          <div className="flex h-full min-h-0 flex-col">
            <nav
              className={cn(communityStyles.communityTabs, "grid-cols-3")}
              aria-label="샘플 메뉴"
              data-create-boundary
            >
              {(
                [
                  ["feed", "탐색"],
                  ["saved", "보관함"],
                  ["mine", "내 등록"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={tab === value}
                  className={tab === value ? sharedStyles.active : ""}
                  onClick={() => selectTab(value)}
                >
                  {label}
                </button>
              ))}
            </nav>
            <div
              key={JSON.stringify([apiOrigin(), userId, tab])}
              className="min-h-0 flex-1 overflow-hidden"
            >
              {tab === "feed" ? (
                <OpensourceScreen
                  onOpen={(id, comments) =>
                    to(comments ? `/sources/${id}/comments` : `/sources/${id}`)
                  }
                  onProfile={(id) => to(`/users/${id}`)}
                />
              ) : tab === "saved" ? (
                <section
                  className={`${workspaceStyles.workspacePage} ${sourceStyles.libraryPage} ${sharedStyles.scrollContent}`}
                >
                  <h1>샘플 보관함</h1>
                  <SavedOpenSources query="" onOpen={(id) => to(`/sources/${id}`)} />
                </section>
              ) : (
                <SourcePublications onOpen={(id) => to(`/sources/${id}`)} />
              )}
            </div>
          </div>
          {tab !== "saved" && <ContextualCreate scope="sources" />}
        </div>
        <Footer activeTab="opensource" />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
