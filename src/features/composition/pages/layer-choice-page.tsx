import { useState } from "react";
import {
  CompositionChoiceScreen,
  type CreationMethod,
} from "@/features/composition/creation-screens";
import { createMidiLayer, releaseAbandonedLayer } from "@/features/composition/composition-actions";
import { NativeLayerChoiceBridge } from "@/features/composition/native-studio-pages-bridge";
import { InstrumentPromptCancelled, useInstrumentPrompt } from "../use-instrument-prompt";
import { useRouteComposition } from "@/features/composition/use-route-composition";
import { PageState } from "@/components/page-state";
import { readId, withQuery } from "@/features/navigation/paths";
import { DesignViewport } from "@/components/design-viewport";
import { Header } from "@/features/navigation/header";
import { Footer } from "@/features/navigation/footer";
import { NotificationsOverlay } from "@/features/notifications/notifications-overlay";
import { creationTarget } from "@/features/navigation/creation-target";
import { resolveSearchScope } from "@/features/search/search-scope";
import { sharedStyles } from "@/styles/shared.styles";
import { nativeApp } from "@/lib/native-app";
export default function LayerChoicePage() {
  const route = useRouteComposition();
  const instrument = useInstrumentPrompt(route.projectId);
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function choose(method: CreationMethod) {
    if (busy || !route.projectId) return;
    setBusy(true);
    setError(null);
    try {
      // A song left with an empty layer of the viewer's (from before "버리기" removed it) would refuse a new one.
      await releaseAbandonedLayer(route.projectId);
      if (method !== "note") {
        to(route.layerUrl(method), { state: route.studioState });
        return;
      }
      const editor = await createMidiLayer(route.projectId, await instrument.ask({ mode: "midi" }));
      to(route.notesUrl(editor), { state: route.studioState });
    } catch (cause) {
      if (!(cause instanceof InstrumentPromptCancelled))
        setError(cause instanceof Error ? cause.message : "레이어를 만들지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }
  const search = () => to(withQuery("/search", { scope, galleryId }));
  if (nativeApp())
    return (
      <>
        <NativeLayerChoiceBridge
          invalid={route.projectId === null}
          busy={busy}
          error={error}
          instrument={instrument.native}
          onChoose={(method) => void choose(method)}
          onBack={() => back(route.studioUrl)}
          onSearch={search}
        />
        <Footer activeTab={null} onCreate={onCreate} createLabel={target.label} />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onSearch={search} onBack={() => back(route.studioUrl)} />
        <div className={sharedStyles.screenBody}>
          {route.projectId === null ? (
            <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
          ) : (
            <CompositionChoiceScreen
              busy={busy}
              error={error}
              onChoose={(method) => {
                void choose(method);
              }}
              onBack={() => to(route.studioUrl, { replace: true, state: route.studioState })}
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
