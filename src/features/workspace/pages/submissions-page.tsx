import { SubmissionsScreen } from "@/features/workspace/contribution-requests";
import { NativeSubmissionsBridge } from "@/features/workspace/native-requests-bridge";
import { nativeApp } from "@/lib/native-app";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { readId, withQuery } from "@/features/navigation/paths";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
export default function SubmissionsPage() {
  const { to, back, params, query } = useUrlNavigation();
  const galleryId = readId(params.galleryId) ?? readId(query.get("galleryId"));
  const scope = resolveSearchScope(query.get("scope"), "songs", Boolean(galleryId));
  const search = () => to(withQuery("/search", { scope, galleryId }));
  const onSelect = (id: number, projectId: number) =>
    to(withQuery(`/submissions/${id}`, { projectId }));
  if (nativeApp())
    return (
      <>
        <NativeSubmissionsBridge
          onSelect={onSelect}
          onSearch={search}
          onBack={() => back("/settings")}
        />
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onSearch={search} onBack={() => back("/settings")} />
        <div className={sharedStyles.screenBody}>
          <SubmissionsScreen onSelect={onSelect} />
        </div>
        <Footer activeTab={null} />
        <NotificationsOverlay />
      </div>
    </DesignViewport>
  );
}
