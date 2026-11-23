import { useState } from "react";
import { Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { TimingDialog } from "./timing-dialog";
import type { ProjectTiming } from "./project-timing";
import type { TimeSignature } from "./time-signature";

export type CreationTimingMode = "initial" | "editable" | "locked";

const readoutBase =
  "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#32323d] bg-[#23232a] px-3 text-body tabular-nums text-app-fg [&_small]:text-caption [&_small]:text-app-muted";

/** Shared top BPM & time signature readout/editor bar for Record and Upload screens. */
export function CreationTimingBar({
  bpm,
  signature,
  onTiming,
  timingMode = onTiming ? "editable" : "locked",
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
      <div className="flex w-full shrink-0 items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
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
                <Pencil size={11} className="text-[#a78bfa]" aria-hidden="true" />
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
                <Pencil size={11} className="text-[#a78bfa]" aria-hidden="true" />
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
        {timingMode === "initial" ? (
          <span className="shrink-0 whitespace-nowrap rounded-full border border-app-primary/40 bg-app-primary/15 px-2.5 py-1 text-[11px] font-semibold text-[#c4b5fd]">
            박자 · BPM 설정
          </span>
        ) : timingMode === "locked" ? (
          <span className="shrink-0 whitespace-nowrap rounded-full border border-[#32323d] bg-[#1e1e26] px-2.5 py-1 text-[11px] font-medium text-app-muted">
            참여 곡 기준
          </span>
        ) : (
          <span className="shrink-0 whitespace-nowrap text-[11px] text-app-muted">탭하여 변경</span>
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
