import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { studioStyles } from "@/styles/studio.styles";
import { Asset } from "@/components/asset";
import { InstrumentDialog, type InstrumentChoice } from "./instrument-dialog";
import { TimingDialog } from "./timing-dialog";
import type { ProjectTiming } from "./project-timing";
import type { TimeSignature } from "./time-signature";
import { clockTime } from "./studio-helpers";
import { findInstrument } from "./instrument-catalog";

// One 36px control height and 16px side margin across the portrait layout.
const iconButton = "grid size-9 shrink-0 place-items-center rounded-[10px] text-app-fg";
const readout =
  "flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[10px] bg-app-surface px-3 text-body tabular-nums [&_small]:text-caption [&_small]:text-app-muted";
const rowScroll = "overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/**
 * The landscape note editor's controls restacked for a 390×844 canvas (Notion 15-1), the default orientation.
 * Playback (rewind, play) and the edit tools sit at the bottom within thumb reach; everything else is on top.
 */
export function PortraitNoteEditor({
  title, bpm, signature, onTiming, timeMs, instrument, playing, onPlay, onPause, onRewind, metronome,
  onMetronome, volume, onVolume, onBack, action, onImportSource, controls, status, tools, roll,
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
  volume: number;
  onVolume: (value: number) => void;
  onBack: () => void;
  /** Shared top-right action: layer navigation for projects, audio completion for samples. */
  action: { label: string; onClick: () => void; disabled?: boolean };
  onImportSource?: () => void;
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
      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
        <button className={iconButton} aria-label="뒤로" onClick={onBack}>
          <Asset name="return.svg" />
        </button>
        <label className="flex min-w-0 flex-1 items-center gap-2">
          <Asset name="sound.svg" />
          <input
            className={studioStyles.studioMasterVolume}
            type="range"
            min={0}
            max={100}
            value={volume}
            onChange={(event) => onVolume(Number(event.target.value))}
            aria-label="마스터 볼륨"
            aria-valuetext={`${volume}%`}
          />
        </label>
        <button
          className={cn(studioStyles.studioAdd, "relative h-9 w-14 shrink-0 rounded-[10px] bg-app-primary disabled:opacity-50 [&_i]:top-[17px]! [&_i]:left-[18px]!")}
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
        {instrument && (
          <button className={readout} aria-label="악기 선택" onClick={() => setInstrumentOpen(true)}>
            <small>악기</small>
            {findInstrument(instrument.value)?.label ?? "선택"}
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
            className="grid size-12 place-items-center rounded-full bg-app-surface text-title font-bold"
            aria-label="처음으로"
            onClick={onRewind}
          >
            |&lt;
          </button>
          <button
            className="grid size-16 place-items-center rounded-full bg-app-primary [&_img]:size-7"
            aria-label={playing ? "일시정지" : "재생"}
            onClick={playing ? onPause : onPlay}
          >
            {playing ? <span className={sharedStyles.pauseSymbol} /> : <Asset name="play.svg" />}
          </button>
          <button
            className="grid size-12 place-items-center rounded-full bg-app-surface aria-pressed:bg-app-primary"
            aria-label="메트로놈"
            aria-pressed={metronome}
            onClick={onMetronome}
          >
            <Asset name="metronome.svg" />
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
