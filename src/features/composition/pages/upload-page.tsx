import { CompositionUploadScreen } from "@/features/composition/creation-screens";
import {
  saveAudioLayer,
  PartialLayerError,
  cancelEmptyLayer,
} from "@/features/composition/composition-actions";
import { InstrumentPromptCancelled, useInstrumentPrompt } from "../use-instrument-prompt";
import { useRef, useState } from "react";
import { useRouteComposition } from "@/features/composition/use-route-composition";
import { PageState } from "@/components/ui/page-state";
import { readId, withQuery } from "@/features/navigation/paths";
import { DesignViewport } from "@/components/ui/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { creationTarget } from "@/features/navigation/creation-target";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
export default function UploadPage() {
  const route = useRouteComposition();
  const instrument = useInstrumentPrompt(route.projectId);
  const partial = useRef<PartialLayerError | null>(null);
  const [cancelError, setCancelError] = useState("");
  async function cancel() {
    try {
      if (route.projectId && partial.current)
        await cancelEmptyLayer(route.projectId, partial.current.trackId);
      back(route.layerUrl("layers/new"));
    } catch (cause) {
      setCancelError(cause instanceof Error ? cause.message : "신규 트랙을 취소하지 못했습니다.");
    }
  }
  const { to, back, params, query, currentPath } = route;
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
          onBack={() => void cancel()}
        />
        <div className={sharedStyles.screenBody}>
          {cancelError && <p role="alert">{cancelError}</p>}
          {route.projectId === null ? (
            <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
          ) : (
            <CompositionUploadScreen
              onBack={() => void cancel()}
              onSave={async (file, selection) => {
                try {
                  if (partial.current?.retry) await partial.current.retry();
                  else
                    await saveAudioLayer(
                      route.projectId!,
                      file,
                      await instrument.ask({ mode: "audio", audio: { file, selection } }),
                      "FILE_UPLOAD",
                      selection,
                    );
                  partial.current = null;
                } catch (cause) {
                  // Closing the chooser keeps the trim screen as it was; it is not a save failure.
                  if (cause instanceof InstrumentPromptCancelled) return;
                  if (cause instanceof PartialLayerError) partial.current = cause;
                  throw cause;
                }
                to(route.studioUrl, { replace: true, state: route.studioState });
              }}
            />
          )}
        </div>
        <Footer activeTab={null} onCreate={onCreate} createLabel={target.label} />
        <NotificationsOverlay />
        {instrument.dialog}
      </div>
    </DesignViewport>
  );
}
