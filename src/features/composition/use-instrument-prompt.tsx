import { useEffect, useRef, useState, type ReactNode } from "react";
import { getComposition } from "@/lib/api/composition";
import { InstrumentDialog } from "./instrument-dialog";
import { useCompositionPlayback } from "./use-composition-playback";
import type { PartTrack } from "./instrument-parts";

export class InstrumentPromptCancelled extends Error {
  constructor() {
    super("악기 선택을 취소했습니다.");
  }
}

/** No layer is created until the caller receives an explicitly confirmed choice. */
export function useInstrumentPrompt(projectId: number | null) {
  const preview = useCompositionPlayback(null);
  const [tracks, setTracks] = useState<PartTrack[]>([]);
  const [mode, setMode] = useState<"midi" | "audio" | null>(null);
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
    setMode(null);
  };
  const dialog: ReactNode =
    mode === null ? null : (
      <InstrumentDialog
        choice={{
          value: null,
          mode,
          tracks,
          onPreview: preview.previewInstrument,
          onConfirm: async (id) => {
            pending.current?.resolve(id);
            pending.current = null;
            setMode(null);
          },
        }}
        onClose={close}
      />
    );
  return {
    dialog,
    async ask(nextMode: "midi" | "audio") {
      if (projectId === null) throw new Error("대상 프로젝트를 먼저 선택해주세요.");
      // A failed permission/occupancy fetch is an error, not an invented empty track list.
      const composition = await getComposition(projectId);
      if (!mounted.current) throw new InstrumentPromptCancelled();
      pending.current?.reject(new InstrumentPromptCancelled());
      setTracks(composition.tracks);
      const { promise, resolve, reject } = Promise.withResolvers<string>();
      pending.current = { resolve, reject };
      setMode(nextMode);
      return promise;
    },
  };
}
