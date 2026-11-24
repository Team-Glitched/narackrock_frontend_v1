import { useState } from "react";
import { cn } from "@/lib/utils";
import { TimingDialog } from "./timing-dialog";
import type { ProjectTiming } from "./project-timing";
import type { TimeSignature } from "./time-signature";

export type CreationTimingMode = "initial" | "editable" | "locked";

const readoutBase =
  "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#32323d] bg-[#23232a] px-3 text-body tabular-nums text-app-fg [&_small]:text-caption [&_small]:text-app-muted";

/** Shared top BPM & time signature readout bar matching PortraitNoteEditor. */
export function CreationTimingBar({
  bpm,
  signature,
  onTiming,
  disabled = false,
}: {
  bpm: number;
  signature: TimeSignature;
  onTiming?: (timing: ProjectTiming) => Promise<void>;
  timingMode?: CreationTimingMode;
  disabled?: boolean;
}) {
  const [dialog, setDialog] = useState<"bpm" | "beat" | null>(null);
  const editable = Boolean(onTiming);

  return (
    <>
      <div className="flex w-full shrink-0 items-center gap-2">
        {editable ? (
          <>
            <button
              type="button"
              disabled={disabled}
              aria-label="bpm 설정"
              onClick={() => setDialog("bpm")}
              className={cn(
                readoutBase,
                "cursor-pointer transition-colors hover:border-app-primary disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <small>bpm</small>
              <span>{bpm}</span>
            </button>
            <button
              type="button"
              disabled={disabled}
              aria-label="박자 설정"
              onClick={() => setDialog("beat")}
              className={cn(
                readoutBase,
                "cursor-pointer transition-colors hover:border-app-primary disabled:cursor-not-allowed disabled:opacity-50",
              )}
            >
              <small>beat</small>
              <span>
                {signature.numerator}/{signature.denominator}
              </span>
            </button>
          </>
        ) : (
          <>
            <span className={readoutBase}>
              <small>bpm</small>
              <span>{bpm}</span>
            </span>
            <span className={readoutBase}>
              <small>beat</small>
              <span>
                {signature.numerator}/{signature.denominator}
              </span>
            </span>
          </>
        )}
      </div>
      {dialog && (
        <TimingDialog
          timing={{ bpm, signature }}
          beat={dialog === "beat"}
          onApply={onTiming}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  );
}
