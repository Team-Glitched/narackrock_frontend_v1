import { useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { compositionQuery } from "./composition-queries";
import {
  InstrumentDialog,
  useNativeInstrumentPicker,
  type InstrumentChoice,
} from "./instrument-dialog";
import { useCompositionPlayback, type AudioAudition } from "./use-composition-playback";
import type { PartTrack } from "./instrument-parts";
import { apiOrigin } from "@/lib/api/client";
import { nativeApp } from "@/lib/native-app";
import { useCurrentUserId } from "@/features/auth/use-current-user";

export class InstrumentPromptCancelled extends Error {
  constructor() {
    super("악기 선택을 취소했습니다.");
  }
}

export type InstrumentPromptRequest = ({ mode: "midi" } | { mode: "audio"; audio: AudioAudition }) & {
  validate?: (id: string) => void;
};

/**
 * No layer is created until the caller receives an explicitly confirmed choice. Browsers render
 * `dialog`; in the app it is null and the page's native screen shows `native.model`
 * (`InstrumentSheet`), forwarding `NativeInstrumentAction`s to `native.act`.
 * Standalone sample creation uses the same chooser without loading a project or its tracks.
 */
export function useInstrumentPrompt(projectId: number | null, options?: { standalone: boolean }) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  const preview = useCompositionPlayback(null, {
    scopeKey: JSON.stringify([apiOrigin(), userId, projectId, "instrument"]),
  });
  const [tracks, setTracks] = useState<PartTrack[]>([]);
  // The open request with its caller's promise; a replaced, closed or unmounted request is cancelled.
  const [request, setRequest] = useState<{
    next: InstrumentPromptRequest;
    resolve: (id: string) => void;
    reject: (error: Error) => void;
  } | null>(null);
  useEffect(() => {
    if (request) return () => request.reject(new InstrumentPromptCancelled());
  }, [request]);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const close = () => setRequest(null);
  const next = request?.next;
  const choice: InstrumentChoice | null =
    request === null || next === undefined
      ? null
      : {
          value: null,
          mode: next.mode,
          tracks,
          onPreview:
            next.mode === "audio"
              ? () => preview.previewAudio(next.audio)
              : preview.previewInstrument,
          onStopPreview: preview.stopPreview,
          onConfirm: async (id) => {
            next.validate?.(id);
            request.resolve(id);
            setRequest(null);
          },
        };
  const native = useNativeInstrumentPicker(nativeApp() ? choice : null, close);
  const dialog: ReactNode =
    choice === null || nativeApp() ? null : <InstrumentDialog choice={choice} onClose={close} />;
  return {
    dialog,
    native,
    async ask(next: InstrumentPromptRequest) {
      if (projectId === null && !options?.standalone) throw new Error("대상 프로젝트를 먼저 선택해주세요.");
      // Read current project access and team usage from the server before showing the chooser.
      const composition = projectId === null ? null : await queryClient.fetchQuery({
        ...compositionQuery(userId, projectId),
        staleTime: 0,
      });
      if (!mounted.current) throw new InstrumentPromptCancelled();
      setTracks(composition?.tracks ?? []);
      const { promise, resolve, reject } = Promise.withResolvers<string>();
      setRequest({ next, resolve, reject });
      return promise;
    },
  };
}
