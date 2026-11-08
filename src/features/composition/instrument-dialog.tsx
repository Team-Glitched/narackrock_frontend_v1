import { sharedStyles } from "@/styles/shared.styles";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { CanvasDialog } from "@/components/canvas-dialog";
import { useEffect, useEffectEvent, useId, useState } from "react";
import { canonicalInstrumentId } from "./instrument-catalog";
import {
  instrumentGroups,
  tracksUsingInstrumentFamily,
  partLabel,
  supportsMidi,
  type PartTrack,
} from "./instrument-parts";

export type InstrumentChoice = {
  /** Current instrument/role of the track being changed, or null when choosing for a new layer. */
  value: string | null;
  /** MIDI layers accept only sampled instruments; audio layers accept recorded roles too. */
  mode: "midi" | "audio";
  tracks: PartTrack[];
  currentTrackId?: number;
  /** MIDI mode plays the candidate's sample phrase; audio mode plays the layer's own original audio. */
  onPreview: (id: string) => Promise<void>;
  /** Stops only this chooser's preview. Called on candidate change, close, confirm and unmount. */
  onStopPreview: () => void;
  onConfirm: (id: string) => Promise<void>;
};

function choiceError(cause: unknown) {
  return cause instanceof Error ? cause.message : "악기를 바꾸지 못했습니다.";
}

/**
 * Grouped picker following the backend instrument families. Previewing never writes; the track is created
 * or changed on "선택 완료". Team usage is informational and never blocks a choice.
 */
export function InstrumentDialog({
  choice,
  onClose,
}: {
  choice: InstrumentChoice;
  onClose: () => void;
}) {
  const titleId = useId();
  const [selected, setSelected] = useState<string | null>(
    choice.value ? canonicalInstrumentId(choice.value) : null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const available = (id: string) => choice.mode === "audio" || supportsMidi(id);
  const stopPreview = useEffectEvent(choice.onStopPreview);
  useEffect(() => () => stopPreview(), []);
  const preview = (id: string) => {
    setError(null);
    void choice.onPreview(id).catch((cause) => setError(choiceError(cause)));
  };
  const close = () => {
    choice.onStopPreview();
    onClose();
  };
  return (
    <CanvasDialog className={sharedStyles.instrumentDialog} titleId={titleId} onClose={close}>
      <h2 id={titleId}>악기 선택</h2>
      <p>같은 악기나 보컬을 여러 명이 함께 선택할 수 있어요.</p>
      <div role="radiogroup" aria-label="악기" className="grid min-h-0 max-h-[320px] flex-1 gap-4 overflow-y-auto overscroll-contain">
        {instrumentGroups.map((group) => {
          const parts = group.instruments.filter(available);
          if (!parts.length) return null;
          const using = tracksUsingInstrumentFamily(choice.tracks, parts[0], choice.currentTrackId);
          return (
            <fieldset key={group.id} disabled={busy}>
              <legend>
                {group.label}
                {using.length ? ` · 다른 레이어 ${using.length}개에서 사용 중 · 함께 선택 가능` : ""}
              </legend>
              <div className="flex flex-wrap gap-2">
                {parts.map((id) => (
                  <button
                    key={id}
                    type="button"
                    role="radio"
                    aria-checked={selected === id}
                    onClick={() => {
                      setSelected(id);
                      preview(id);
                    }}
                  >
                    {partLabel(id)}
                  </button>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>
      {choice.mode === "audio" && (
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className={buttonVariants({ tone: "secondary", size: "compact" })}
            disabled={busy}
            onClick={() => preview(selected ?? "")}
          >
            원본 듣기
          </button>
          <button
            type="button"
            className={buttonVariants({ tone: "secondary", size: "compact" })}
            onClick={choice.onStopPreview}
          >
            정지
          </button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        className={cn(buttonVariants({ tone: "primary", size: "compact" }), "w-full shrink-0 justify-center")}
        disabled={busy || !selected || selected === canonicalInstrumentId(choice.value)}
        onClick={async () => {
          if (!selected) return;
          choice.onStopPreview();
          setBusy(true);
          setError(null);
          try {
            await choice.onConfirm(selected);
            onClose();
          } catch (cause) {
            setError(choiceError(cause));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? "적용 중..." : "선택 완료"}
      </button>
    </CanvasDialog>
  );
}
