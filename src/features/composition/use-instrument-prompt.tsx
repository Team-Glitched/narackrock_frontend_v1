import { useEffect, useRef, useState, type ReactNode } from "react";
import { getComposition } from "@/lib/api/composition";
import { InstrumentDialog } from "./instrument-dialog";
import { useCompositionPlayback, type AudioAudition } from "./use-composition-playback";
import type { PartTrack } from "./instrument-parts";
import { apiOrigin } from "@/lib/api/client";
import { useCurrentUserId } from "@/features/auth/use-current-user";

export class InstrumentPromptCancelled extends Error {
  constructor() {
    super("악기 선택을 취소했습니다.");
  }
}

export type InstrumentPromptRequest = { mode: "midi" } | { mode: "audio"; audio: AudioAudition };

/** No layer is created until the caller receives an explicitly confirmed choice. */
export function useInstrumentPrompt(projectId: number | null) {
  const userId = useCurrentUserId();
  const preview = useCompositionPlayback(null, {
    scopeKey: JSON.stringify([apiOrigin(), userId, projectId, "instrument"]),
  });
  const [tracks, setTracks] = useState<PartTrack[]>([]);
  const [request, setRequest] = useState<InstrumentPromptRequest | null>(null);
  const pending = useRef<{ resolve: (id: string) => void; reject: (error: Error) => void } | null>(
    null,
  );
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      pending.current?.reject(new InstrumentPromptCancelled());
      pending.current = null;
    };
  }, []);
  const close = () => {
    pending.current?.reject(new InstrumentPromptCancelled());
    pending.current = null;
    setRequest(null);
  };
  const dialog: ReactNode =
    request === null ? null : (
      <InstrumentDialog
        choice={{
          value: null,
          mode: request.mode,
          tracks,
          onPreview:
            request.mode === "audio"
              ? () => preview.previewAudio(request.audio)
              : preview.previewInstrument,
          onStopPreview: preview.stopPreview,
          onConfirm: async (id) => {
            pending.current?.resolve(id);
            pending.current = null;
            setRequest(null);
          },
        }}
        onClose={close}
      />
    );
  return {
    dialog,
    async ask(next: InstrumentPromptRequest) {
      if (projectId === null) throw new Error("대상 프로젝트를 먼저 선택해주세요.");
      // Fetch current project access and team usage before showing the chooser.
      const composition = await getComposition(projectId);
      if (!mounted.current) throw new InstrumentPromptCancelled();
      pending.current?.reject(new InstrumentPromptCancelled());
      setTracks(composition.tracks);
      const { promise, resolve, reject } = Promise.withResolvers<string>();
      pending.current = { resolve, reject };
      setRequest(next);
      return promise;
    },
  };
}
