import { studioStyles } from "@/styles/studio.styles";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { useState } from "react";
import { VolumeDialog } from "@/features/composition/volume-dialog";
import { InstrumentDialog, type InstrumentChoice } from "@/features/composition/instrument-dialog";
import { TimingDialog } from "@/features/composition/timing-dialog";
import type { ProjectTiming } from "@/features/composition/project-timing";
import { Asset } from "@/components/asset";
import { defaultSignature, type TimeSignature } from "@/features/composition/time-signature";
import type { NativeTransport, NativeTransportAction } from "@/lib/native-screens";
import { clockTime } from "./studio-helpers";
import { findInstrument } from "./instrument-catalog";

/** The parts of `useCompositionPlayback` the transport toolbar reads and drives. */
export type TransportPlayback = {
  nativeEngine: string | null;
  playing: boolean;
  positionMs: number;
  signature: TimeSignature;
  metronome: boolean;
  volume: number;
  error: string | null;
  play: () => Promise<void>;
  pause: () => void;
  seek: (positionMs: number) => void;
  setVolume: (value: number) => void;
  setMetronome: (update: (value: boolean) => boolean) => void;
};

/** The app toolbar's readouts for `playback` and its project tempo. */
export function nativeTransport(playback: TransportPlayback, bpm: number): NativeTransport {
  return {
    engine: playback.nativeEngine,
    playing: playback.playing,
    positionMs: Math.floor(playback.positionMs / 1000) * 1000,
    bpm,
    numerator: playback.signature.numerator,
    denominator: playback.signature.denominator,
    metronome: playback.metronome,
    volume: playback.volume,
    error: playback.error,
  };
}

/** Runs a toolbar action the way the web toolbar's buttons do. */
export function transportAction(playback: TransportPlayback, action: NativeTransportAction) {
  switch (action.type) {
    case "transport-play":
      void playback.play();
      return;
    case "transport-pause":
      return playback.pause();
    case "transport-metronome":
      return playback.setMetronome((value) => !value);
    case "transport-volume":
      return playback.setVolume(action.value);
    case "transport-seek":
      return playback.seek(action.positionMs);
  }
}

export function StudioToolbar({
  title,
  bpm,
  playing,
  positionMs,
  onPlay,
  onPause,
  onBack,
  onRewind,
  children,
  piano,
  volume,
  onVolume,
  onAdd,
  metronome,
  onMetronome,
  onTiming,
  instrument,
  onImportSource,
  signature = defaultSignature,
  addLabel = "타임라인 검토",
}: {
  signature?: TimeSignature;
  /** Saves BPM and time signature together; omitted when the viewer may not change them. */
  onTiming?: (timing: ProjectTiming) => Promise<void>;
  /** Instrument picker for the edited track; omitted when it cannot be changed. */
  instrument?: InstrumentChoice;
  addLabel?: string;
  onImportSource?: () => void;
  title: string;
  bpm: number;
  playing: boolean;
  positionMs: number;
  onPlay: () => void;
  onPause: () => void;
  onBack: () => void;
  onRewind?: () => void;
  children?: React.ReactNode;
  metronome?: boolean;
  onMetronome?: () => void;
  piano?: boolean;
  volume?: number;
  onVolume?: (value: number) => void;
  onAdd?: () => void;
}) {
  const [volumeOpen, setVolumeOpen] = useState(false);
  const [instrumentOpen, setInstrumentOpen] = useState(false);
  const [timing, setTiming] = useState<"bpm" | "beat" | null>(null);
  const masterVolume = (
    <input
      className={studioStyles.studioMasterVolume}
      type="range"
      min={0}
      max={100}
      value={volume ?? 20}
      onChange={(event) => onVolume?.(Number(event.target.value))}
      disabled={!onVolume}
      aria-label="마스터 볼륨"
      aria-valuetext={`${volume ?? 20}%`}
    />
  );
  return (
    <div className={cn(studioStyles.studioToolbar, piano ? "team-original-toolbar" : "")}>
      <div className={studioStyles.studioTransport}>
        <button onClick={onBack} aria-label="뒤로">
          <Asset name="return.svg" />
        </button>
        {onRewind && (
          <button onClick={onRewind} aria-label="처음으로">
            |&lt;
          </button>
        )}
        <button onClick={playing ? onPause : onPlay} aria-label={playing ? "일시정지" : "재생"}>
          {playing ? <span className={sharedStyles.pauseSymbol} /> : <Asset name="play.svg" />}
        </button>
        <button
          className={studioStyles.studioMetronome}
          aria-label="메트로놈"
          aria-pressed={metronome ?? false}
          onClick={onMetronome}
        >
          <Asset name="metronome.svg" />
        </button>
      </div>
      <strong className={"sr-only"}>{title}</strong>
      <div className={studioStyles.studioReadouts}>
        {onTiming ? (
          <>
            <button
              className={studioStyles.studioTiming}
              onClick={() => setTiming("bpm")}
              aria-label="bpm 설정"
            >
              <small>bpm</small>
              {bpm}
            </button>
            <button
              className={studioStyles.studioTiming}
              onClick={() => setTiming("beat")}
              aria-label="박자 설정"
            >
              <small>beat</small>
              {signature.numerator}/{signature.denominator}
            </button>
          </>
        ) : (
          <>
            <span className={studioStyles.studioTiming}>
              <small>bpm</small>
              {bpm}
            </span>
            <span className={studioStyles.studioTiming}>
              <small>beat</small>
              {signature.numerator}/{signature.denominator}
            </span>
          </>
        )}
        <span>
          <small>time</small>
          {`00:${clockTime(positionMs)}`}
        </span>
        {onImportSource && (
          <button
            className={studioStyles.midiImportTrigger}
            aria-label="샘플 추가"
            onClick={onImportSource}
          >
            <span aria-hidden="true">+</span>
            <span>샘플</span>
          </button>
        )}
        {piano && instrument && (
          <button
            className={studioStyles.studioTiming}
            aria-label="악기 선택"
            onClick={() => setInstrumentOpen(true)}
          >
            <small>악기</small>
            {findInstrument(instrument.value)?.label ?? "선택"}
          </button>
        )}
      </div>
      <div className={studioStyles.studioVolume}>
        <button
          className={studioStyles.studioVolumeTrigger}
          aria-label="음량 설정"
          onClick={() => setVolumeOpen(true)}
        >
          <Asset name="sound.svg" />
        </button>
        {masterVolume}
      </div>
      {volumeOpen && (
        <VolumeDialog
          value={volume ?? 20}
          onChange={(value) => onVolume?.(value)}
          onClose={() => setVolumeOpen(false)}
        />
      )}
      {instrumentOpen && instrument && (
        <InstrumentDialog choice={instrument} onClose={() => setInstrumentOpen(false)} />
      )}
      {timing && (
        <TimingDialog
          timing={{ bpm, signature }}
          beat={timing === "beat"}
          onApply={onTiming}
          onClose={() => setTiming(null)}
        />
      )}
      {!piano && children}
      {piano && onAdd && (
        <>
          <button
            className={studioStyles.studioAdd}
            aria-label={addLabel}
            disabled={!onAdd}
            onClick={onAdd}
          >
            <i />
          </button>
        </>
      )}
    </div>
  );
}
