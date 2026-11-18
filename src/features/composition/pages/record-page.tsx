import type { AudioTranscriptionMode } from "@/lib/api/composition";
import { CompositionRecordScreen } from "@/features/composition/creation-screens";
import {
  recordingToMidi,
  saveAudioLayer,
  PartialLayerError,
  cancelEmptyLayer,
} from "@/features/composition/composition-actions";
import { InstrumentPromptCancelled, useInstrumentPrompt } from "../use-instrument-prompt";
import { useRef, useState } from "react";
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
import { NativeRecordBridge } from "@/features/composition/native-creation-bridges";
import { NativePageStateBridge } from "@/features/community/native-community-bridge";
export default function RecordPage() {
  const route = useRouteComposition();
  const instrument = useInstrumentPrompt(route.projectId);
  const partial = useRef<{ error: PartialLayerError; mode: "audio" | "midi" } | null>(null);
  const [cancelError, setCancelError] = useState("");
  async function cancel() {
    try {
      if (route.projectId && partial.current)
        await cancelEmptyLayer(route.projectId, partial.current.error.trackId);
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
  const search = () => to(withQuery("/search", { scope, galleryId }));
  async function save(file: File) {
    try {
      if (partial.current) {
        if (partial.current.mode !== "audio" || !partial.current.error.retry)
          throw new Error("이전 MIDI 초안 저장을 먼저 재시도하거나 취소해주세요.");
        await partial.current.error.retry();
      } else
        await saveAudioLayer(
          route.projectId!,
          file,
          await instrument.ask({ mode: "audio", audio: { file } }),
          "RECORDING",
        );
      partial.current = null;
    } catch (cause) {
      // Closing the chooser keeps the recording; it is not a save failure.
      if (cause instanceof InstrumentPromptCancelled) return;
      if (cause instanceof PartialLayerError) partial.current = { error: cause, mode: "audio" };
      throw cause;
    }
    to(route.studioUrl, { replace: true, state: route.studioState });
  }
  async function transform(file: File, soundKind: AudioTranscriptionMode = "AUTO") {
    try {
      if (partial.current) {
        if (partial.current.mode !== "midi" || !partial.current.error.retry)
          throw new Error("이전 오디오 저장을 먼저 재시도하거나 취소해주세요.");
        await partial.current.error.retry();
        to(route.notesUrl({ trackId: partial.current.error.trackId, clipId: null }), {
          replace: true,
          state: route.studioState,
        });
      } else {
        const editor = await recordingToMidi(
          route.projectId!,
          file,
          await instrument.ask({ mode: "midi" }),
          soundKind,
        );
        to(route.notesUrl(editor), {
          replace: true,
          state: { ...route.studioState, conversionNotice: editor.conversionNotice },
        });
      }
    } catch (cause) {
      if (cause instanceof InstrumentPromptCancelled) return;
      if (cause instanceof PartialLayerError) partial.current = { error: cause, mode: "midi" };
      throw cause;
    }
  }
  if (nativeApp())
    return (
      <>
        {route.projectId === null ? (
          <NativePageStateBridge
            state={{
              message: "올바르지 않은 페이지 주소입니다.",
              tone: "error",
              createLabel: null,
            }}
            onBack={() => void cancel()}
            onSearch={search}
          />
        ) : (
          <NativeRecordBridge
            onSave={save}
            onTransform={transform}
            instrument={instrument.native}
            notice={cancelError || null}
            onBack={() => void cancel()}
            onSearch={search}
          />
        )}
        <Footer activeTab={null} onCreate={onCreate} createLabel={target.label} />
        <NotificationsOverlay />
      </>
    );
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <Header onSearch={search} onBack={() => void cancel()} />
        <div className={sharedStyles.screenBody}>
          {cancelError && <p role="alert">{cancelError}</p>}
          {route.projectId === null ? (
            <PageState error>올바르지 않은 페이지 주소입니다.</PageState>
          ) : (
            <CompositionRecordScreen
              onBack={() => void cancel()}
              onSave={save}
              onTransform={transform}
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
