import { SubmissionDetailScreen } from "@/features/workspace/workspace-screens";
import { PageState } from "@/components/page-state";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, studioPath, withQuery } from "@/features/navigation/paths";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { creationTarget } from "@/features/navigation/creation-target";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
export default function SubmissionPage() {
  const { to, back, params, query, currentPath } = useUrlNavigation();
  const submissionId = readId(params.submissionId);
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const target = creationTarget(scope, galleryId);
  const onCreate = () =>
    to(
      target.path,
      target.path === "/studio/new"
        ? { state: { studioFrom: currentPath, studioIndex: window.history.state?.idx } }
        : undefined,
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header
          onSearch={() => to(withQuery("/search", { scope, galleryId }))}
          onBack={() => back("/submissions")}
        />
        <div className={sharedStyles.screenBody}>
          {submissionId === null ? (
            <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
          ) : (
            <SubmissionDetailScreen
              key={submissionId}
              id={submissionId}
              projectId={readId(query.get("projectId"))}
              onResume={(id, shortId) =>
                to(studioPath(id, shortId), {
                  state: { studioFrom: currentPath, studioIndex: window.history.state?.idx },
                })
              }
            />
          )}
        </div>
        <Footer activeTab={null} onCreate={onCreate} createLabel={target.label} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
