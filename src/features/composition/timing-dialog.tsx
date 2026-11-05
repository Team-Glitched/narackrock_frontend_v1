import { sharedStyles } from "@/styles/shared.styles";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { CanvasDialog } from "@/components/canvas-dialog";
import { DialogNumberInput } from "@/features/composition/dialog-number-input";
import type { TimeSignature } from "@/features/composition/time-signature";
import { useId, useState } from "react";

export type ProjectTiming = { bpm: number; signature: TimeSignature };

const denominators = [2, 4, 8, 16];

/** Backend timing limits: BPM 30–300, numerator 1–12, denominator 2/4/8/16. */
export function timingProblem({ bpm, signature }: ProjectTiming): string | null {
  if (!Number.isInteger(bpm) || bpm < 30 || bpm > 300)
    return "BPM은 30부터 300까지 입력할 수 있습니다.";
  if (!Number.isInteger(signature.numerator) || signature.numerator < 1 || signature.numerator > 12)
    return "마디당 박 수는 1부터 12까지입니다.";
  if (!denominators.includes(signature.denominator))
    return "기준 음표는 2, 4, 8, 16 중 하나여야 합니다.";
  return null;
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
              max={12}
              label="마디당 박 수"
              disabled={!editable}
              onChange={(numerator) =>
                setDraft((old) => ({ ...old, signature: { ...old.signature, numerator } }))
              }
            />
            <span>/</span>
            <select
              aria-label="기준 음표"
              value={draft.signature.denominator}
              disabled={!editable}
              onChange={(event) =>
                setDraft((old) => ({
                  ...old,
                  signature: { ...old.signature, denominator: Number(event.target.value) },
                }))
              }
            >
              {denominators.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <>
            <input
              aria-label="bpm"
              type="range"
              min={30}
              max={300}
              value={draft.bpm}
              disabled={!editable}
              onChange={(event) => setDraft((old) => ({ ...old, bpm: Number(event.target.value) }))}
              style={{
                background: `linear-gradient(to right,var(--white) ${((draft.bpm - 30) / 270) * 100}%,var(--line-strong) 0)`,
              }}
            />
            <DialogNumberInput
              value={draft.bpm}
              min={30}
              max={300}
              label="BPM 직접 입력"
              disabled={!editable}
              onChange={(bpm) => setDraft((old) => ({ ...old, bpm }))}
            />
          </>
        )}
      </div>
      {!editable && <p>곡의 BPM과 박자는 원작성자만 바꿀 수 있습니다.</p>}
      {editable && problem && <p role="alert">{problem}</p>}
      {error && <p role="alert">{error}</p>}
      {editable && (
        <button
          className={buttonVariants({ tone: "primary", size: "compact" })}
          disabled={busy || problem !== null}
          onClick={async () => {
            if (!onApply) return;
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
          }}
        >
          {busy ? "저장 중..." : "적용"}
        </button>
      )}
      {!editable && (
        <button
          className={buttonVariants({ tone: "secondary", size: "compact" })}
          onClick={onClose}
        >
          닫기
        </button>
      )}
    </CanvasDialog>
  );
}
