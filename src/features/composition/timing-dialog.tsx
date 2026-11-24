import { sharedStyles } from "@/styles/shared.styles";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { CanvasDialog } from "@/components/canvas-dialog";
import { DialogNumberInput } from "@/features/composition/dialog-number-input";
import type { NativeTimingAction, NativeTimingSheet } from "@/lib/native-screens";
import { useId, useState } from "react";
import { timingProblem, type ProjectTiming } from "./project-timing";

/** Saving state of a timing dialog: "적용" saves, closes on success and shows the failure otherwise. */
function useTimingApply(
  onApply: ((timing: ProjectTiming) => Promise<void>) | undefined,
  onClose: () => void,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return {
    busy,
    error,
    setError,
    async apply(draft: ProjectTiming) {
      if (!onApply || busy) return;
      setBusy(true);
      setError(null);
      try {
        await onApply(draft);
        onClose();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "곡 설정을 저장하지 못했습니다.");
      } finally {
        setBusy(false);
      }
    },
  };
}

/**
 * The app's timing sheet over the same rules: the readouts open it (`timing-open`), "적용" saves
 * through `onApply` (absent when the viewer may not change timing: read-only with "닫기").
 */
export function useNativeTiming(
  timing: ProjectTiming,
  onApply?: (timing: ProjectTiming) => Promise<void>,
): { model: NativeTimingSheet | null; act: (action: NativeTimingAction) => void } {
  const [open, setOpen] = useState<"bpm" | "beat" | null>(null);
  const saving = useTimingApply(onApply, () => setOpen(null));
  return {
    model:
      open === null
        ? null
        : {
            kind: open,
            bpm: timing.bpm,
            numerator: timing.signature.numerator,
            denominator: timing.signature.denominator,
            editable: Boolean(onApply),
            busy: saving.busy,
            error: saving.error,
          },
    act(action) {
      if (action.type === "timing-open") {
        saving.setError(null);
        setOpen(action.kind);
      } else if (action.type === "timing-close") {
        if (!saving.busy) setOpen(null);
      } else if (timingProblem({ bpm: action.bpm, signature: action }) === null)
        void saving.apply({
          bpm: action.bpm,
          signature: { numerator: action.numerator, denominator: action.denominator },
        });
    },
  };
}

/**
 * V3 tempo (15098:39655) and time signature (15098:39669). Edits stay local until "적용", which saves the
 * shared project timing; without `onApply` (not the original owner) the values are read-only.
 */
export function TimingDialog({
  timing,
  beat = false,
  onApply,
  onClose,
}: {
  timing: ProjectTiming;
  beat?: boolean;
  onApply?: (timing: ProjectTiming) => Promise<void>;
  onClose: () => void;
}) {
  const titleId = useId();
  const [draft, setDraft] = useState(timing);
  const { busy, error, apply } = useTimingApply(onApply, onClose);
  const problem = timingProblem(draft);
  const editable = Boolean(onApply);
  return (
    <CanvasDialog
      className={cn(sharedStyles.volumeDialog, "timing-dialog")}
      titleId={titleId}
      onClose={onClose}
    >
      <h2 id={titleId}>{beat ? "beat" : "bpm"}</h2>
      <div className={sharedStyles.volumeDialogRow}>
        {beat ? (
          <div className={sharedStyles.timeSignatureFields}>
            <DialogNumberInput
              value={draft.signature.numerator}
              min={1}
              max={16}
              clamp={false}
              label="마디당 박 수"
              disabled={!editable}
              onChange={(numerator) =>
                setDraft((old) => ({ ...old, signature: { ...old.signature, numerator } }))
              }
            />
            <span className="shrink-0 text-title font-bold text-app-muted select-none">/</span>
            <DialogNumberInput
              value={draft.signature.denominator}
              min={1}
              max={16}
              clamp={false}
              label="기준 음표"
              disabled={!editable}
              onChange={(denominator) =>
                setDraft((old) => ({
                  ...old,
                  signature: { ...old.signature, denominator },
                }))
              }
            />
          </div>
        ) : (
          <>
            <input
              aria-label="bpm"
              type="range"
              min={30}
              max={300}
              value={Math.min(300, Math.max(30, draft.bpm))}
              disabled={!editable}
              onChange={(event) => setDraft((old) => ({ ...old, bpm: Number(event.target.value) }))}
              style={{
                background: `linear-gradient(to right,var(--white) ${Math.max(0, Math.min(100, ((draft.bpm - 30) / 270) * 100))}%,var(--line-strong) 0)`,
              }}
            />
            <DialogNumberInput
              value={draft.bpm}
              min={30}
              max={300}
              clamp={false}
              label="BPM 직접 입력"
              disabled={!editable}
              onChange={(bpm) => setDraft((old) => ({ ...old, bpm }))}
            />
          </>
        )}
      </div>
      {!editable && <p className="m-0 text-caption text-app-muted">곡의 BPM과 박자는 원작성자만 바꿀 수 있습니다.</p>}
      {editable && problem && <p role="alert" className="m-0 text-caption text-[#ff9ca8]">{problem}</p>}
      {error && <p role="alert" className="m-0 text-caption text-[#ff9ca8]">{error}</p>}
      {editable && (
        <button
          className={cn(
            buttonVariants({ tone: "primary", size: "compact" }),
            "h-10 w-full justify-center rounded-[12px]",
          )}
          disabled={busy || problem !== null}
          onClick={() => void apply(draft)}
        >
          {busy ? "저장 중..." : "적용"}
        </button>
      )}
      {!editable && (
        <button
          className={cn(
            buttonVariants({ tone: "secondary", size: "compact" }),
            "h-10 w-full justify-center rounded-[12px]",
          )}
          onClick={onClose}
        >
          닫기
        </button>
      )}
    </CanvasDialog>
  );
}
