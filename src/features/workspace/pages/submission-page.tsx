import { SubmissionDetailScreen } from "@/features/workspace/contribution-requests";
import { NativeSubmissionBridge } from "@/features/workspace/native-requests-bridge";
import { nativeApp } from "@/lib/native-app";
import { PageState } from "@/components/page-state";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
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
  const search = () => to(withQuery("/search", { scope, galleryId }));
  const projectId = readId(query.get("projectId"));
  const onResume = (id: number, contributionId: number) =>
    to(withQuery(`/studio/${id}`, { contributionId }), {
      state: {
        studioFrom: currentPath,
        studioIndex: window.history.state?.idx,
        inbox: true,
      },
    });
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onSearch={search} onBack={() => back("/submissions")} />
        <div className={sharedStyles.screenBody}>
          {submissionId === null ? (
            <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
          ) : (
            <SubmissionDetailScreen
              key={`${submissionId}:${query.get("projectId")}`}
              id={submissionId}
              projectId={projectId}
              onResume={onResume}
            />
          )}
          {nativeApp() && (
            <NativeSubmissionBridge
              key={`${submissionId}:${query.get("projectId")}`}
              id={submissionId}
              projectId={projectId}
              onResume={onResume}
              onSearch={search}
              onBack={() => back("/submissions")}
            />
          )}
        </div>
        <Footer activeTab={null} onCreate={onCreate} createLabel={target.label} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
