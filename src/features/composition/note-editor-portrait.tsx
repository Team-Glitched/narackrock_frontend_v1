import { useState, type ReactNode } from "react";
import { Drum, Music } from "lucide-react";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { studioStyles } from "@/styles/studio.styles";
import { Asset } from "@/components/asset";
import { InstrumentDialog, type InstrumentChoice } from "./instrument-dialog";
import { MetronomeIcon } from "./metronome-icon";
import { RewindIcon } from "./rewind-icon";
import { TimingDialog } from "./timing-dialog";
import type { ProjectTiming } from "./project-timing";
import type { TimeSignature } from "./time-signature";
import { clockTime } from "./studio-helpers";
import { findInstrument } from "./instrument-catalog";

// One 36px control height and 16px side margin across the portrait layout.
const iconButton = "grid size-9 shrink-0 place-items-center rounded-[10px] text-app-fg";
const readout =
  "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#32323d] bg-[#23232a] px-3 text-body tabular-nums text-app-fg [&_small]:text-caption [&_small]:text-app-muted";
const topPill =
  "flex h-9 min-w-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] border border-[#32323d] bg-[#23232a] px-2.5 text-caption font-medium text-app-fg transition-colors hover:border-[#5b00ff] disabled:opacity-40";
const rowScroll = "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * The landscape note editor's controls restacked for a 390×844 canvas (Notion 15-1), the default orientation.
 * Playback (rewind, play) and the edit tools sit at the bottom within thumb reach; everything else is on top.
 */
export function PortraitNoteEditor({
  title, bpm, signature, onTiming, timeMs, instrument, playing, onPlay, onPause, onRewind, metronome,
  onMetronome, onBack, action, onImportSource, onChord, drumToggle, controls, status, tools, roll,
}: {
  title: string;
  bpm: number;
  signature: TimeSignature;
  /** Omitted when the viewer may not change the shared timing. */
  onTiming?: (timing: ProjectTiming) => Promise<void>;
  timeMs: number;
  instrument?: InstrumentChoice;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onRewind: () => void;
  metronome: boolean;
  onMetronome: () => void;
  onBack: () => void;
  /** Shared top-right action: layer navigation for projects, audio completion for samples. */
  action: { label: string; onClick: () => void; disabled?: boolean };
  onImportSource?: () => void;
  onChord?: () => void;
  drumToggle?: { expanded: boolean; hidden: number; onToggle: () => void };
  /** Selection, history, grid actions and the status row from the landscape layout. */
  controls: ReactNode;
  status: ReactNode;
  /** Draw/select/erase/pan buttons, shown in the bottom bar. */
  tools: ReactNode;
  roll: ReactNode;
}) {
  const [timingDialog, setTimingDialog] = useState<"bpm" | "beat" | null>(null);
  const [instrumentOpen, setInstrumentOpen] = useState(false);
  return (
    <>
      <strong className="sr-only">{title}</strong>
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <button className={iconButton} aria-label="뒤로" onClick={onBack}>
          <Asset name="return.svg" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {instrument && (
            <button
              type="button"
              className={cn(topPill, "max-w-[140px]")}
              aria-label="악기 선택"
              disabled={instrument.disabled}
              onClick={() => setInstrumentOpen(true)}
            >
              <span className="text-app-muted">악기</span>
              <span className="truncate font-semibold">{findInstrument(instrument.value)?.label ?? "선택"}</span>
            </button>
          )}
          {onChord && (
            <button type="button" className={topPill} aria-label="코드 입력" onClick={onChord}>
              <Music size={14} aria-hidden="true" />
              <span>코드 입력</span>
            </button>
          )}
          {drumToggle && (
            <button
              type="button"
              className={cn(
                topPill,
                "aria-pressed:border-app-primary aria-pressed:bg-app-primary aria-pressed:text-white",
              )}
              aria-pressed={drumToggle.expanded}
              aria-label={`전체 키트${drumToggle.hidden ? `, 숨은 노트 ${drumToggle.hidden}개` : ""}`}
              onClick={drumToggle.onToggle}
            >
              <Drum size={14} aria-hidden="true" />
              <span>전체 키트</span>
              {drumToggle.hidden > 0 && (
                <span className="rounded-full bg-app-bg/70 px-1 text-[11px] tabular-nums" aria-hidden="true">
                  +{drumToggle.hidden}
                </span>
              )}
            </button>
          )}
        </div>
        <button
          className={cn(studioStyles.studioAdd, "relative h-9 w-14 shrink-0 rounded-[10px] bg-app-primary disabled:opacity-50")}
          aria-label={action.label}
          title={action.label}
          disabled={action.disabled}
          onClick={action.onClick}
        >
          <i />
        </button>
      </div>
      <div className={cn("flex h-12 shrink-0 items-center gap-2 px-4", rowScroll)}>
        {onTiming ? (
          <>
            <button className={readout} aria-label="bpm 설정" onClick={() => setTimingDialog("bpm")}>
              <small>bpm</small>{bpm}
            </button>
            <button className={readout} aria-label="박자 설정" onClick={() => setTimingDialog("beat")}>
              <small>beat</small>{signature.numerator}/{signature.denominator}
            </button>
          </>
        ) : (
          <>
            <span className={readout}><small>bpm</small>{bpm}</span>
            <span className={readout}><small>beat</small>{signature.numerator}/{signature.denominator}</span>
          </>
        )}
        <span className={readout}><small>time</small>{`00:${clockTime(timeMs)}`}</span>
        {onImportSource && (
          <button className={readout} aria-label="샘플 추가" onClick={onImportSource}>
            <span aria-hidden="true">+</span>
            샘플
          </button>
        )}
      </div>
      {controls}
      {status}
      <div className={studioStyles.portraitRoll}>{roll}</div>
      <div className="mx-4 mt-3 mb-6 flex shrink-0 flex-col gap-4">
        {tools}
        <div className="flex items-center justify-center gap-8">
          <button
            className="grid size-12 place-items-center rounded-full border border-[#32323d] bg-[#23232a] text-app-fg transition-colors"
            aria-label="처음으로"
            onClick={onRewind}
          >
            <RewindIcon size={20} />
          </button>
          <button
            className="grid size-16 place-items-center rounded-full bg-app-primary [&_img]:size-7"
            aria-label={playing ? "일시정지" : "재생"}
            onClick={playing ? onPause : onPlay}
          >
            {playing ? <span className={sharedStyles.pauseSymbol} /> : <Asset name="play.svg" />}
          </button>
          <button
            className="grid size-12 place-items-center rounded-full border border-[#32323d] bg-[#23232a] text-[#F2F4F6] transition-colors aria-pressed:border-[#9966ff] aria-pressed:bg-app-primary aria-pressed:text-white"
            aria-label="메트로놈"
            aria-pressed={metronome}
            onClick={onMetronome}
          >
            <MetronomeIcon size={22} />
          </button>
        </div>
      </div>
      {timingDialog && (
        <TimingDialog
          timing={{ bpm, signature }}
          beat={timingDialog === "beat"}
          onApply={onTiming}
          onClose={() => setTimingDialog(null)}
        />
      )}
      {instrumentOpen && instrument && (
        <InstrumentDialog choice={instrument} onClose={() => setInstrumentOpen(false)} />
      )}
    </>
  );
}
