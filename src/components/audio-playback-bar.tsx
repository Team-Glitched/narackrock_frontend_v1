import { sourceStyles } from "@/styles/source.styles";
import { cn } from "@/lib/utils";
import { keyboardSeekMs } from "@/lib/playback-progress";
import { Pause } from "lucide-react";
import { Asset } from "./asset";
export function playbackClock(ms: number) {
  const value = Number.isFinite(ms) ? Math.max(0, Math.floor(ms / 1000)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}
export function AudioPlaybackBar({
  playing,
  muted,
  positionMs,
  durationMs,
  onToggle,
  onSeek,
  onMute,
  disabled = false,
  loading = false,
  label = "오디오",
}: {
  playing: boolean;
  muted: boolean;
  positionMs: number;
  durationMs: number | null;
  onToggle: () => void;
  onSeek: (ms: number) => void;
  onMute: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
}) {
  const position = Math.max(0, durationMs === null ? positionMs : Math.min(positionMs, durationMs));
  const elapsed = playbackClock(position);
  const duration = durationMs === null ? "‒:‒" : playbackClock(durationMs);
  return (
    <div
      className={cn(
        sourceStyles.osAudioPlayer,
        "flex h-10 w-full items-center gap-[9px] rounded-[10px] bg-app-surface px-3",
      )}
      aria-label={`${label} 재생바`}
    >
      <button
        type="button"
        className={
          "flex h-full w-6 min-w-0 flex-[0_0_24px] items-center justify-center gap-[9px] [&>img]:h-[18px] [&>img]:w-[15px]"
        }
        disabled={disabled || loading}
        aria-label={`${label} ${playing ? "일시정지" : "재생"}`}
        aria-pressed={playing}
        aria-busy={loading}
        onClick={onToggle}
      >
        {playing ? <Pause aria-hidden="true" size={18} /> : <Asset name="play.svg" />}
      </button>
      <span className={"flex-none text-body tabular-nums"}>
        {elapsed} / {duration}
      </span>
      <input
        className={
          "m-0 h-1 w-0 min-w-0 flex-1 cursor-pointer appearance-none rounded border-0 p-0 disabled:cursor-default [&::-webkit-slider-thumb]:size-[10px] [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-app-fg [&::-moz-range-thumb]:size-[10px] [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-app-fg"
        }
        type="range"
        aria-label={`${label} 재생 위치`}
        aria-valuetext={`${elapsed} / ${durationMs === null ? "재생 시간 정보 없음" : duration}`}
        min={0}
        max={durationMs || 0}
        step="any"
        value={durationMs === null ? 0 : position}
        disabled={disabled || loading || !durationMs}
        onChange={(event) => onSeek(Number(event.target.value))}
        onKeyDown={(event) => {
          const next = durationMs ? keyboardSeekMs(event.key, position, durationMs) : null;
          if (next === null) return;
          event.preventDefault();
          onSeek(next);
        }}
        style={{
          background: `linear-gradient(to right,var(--purple) ${durationMs ? (position / durationMs) * 100 : 0}%,var(--line-strong) 0)`,
        }}
      />
      <button
        type="button"
        className={"grid h-8 w-6 flex-none place-items-center [&>img]:h-[18px] [&>img]:w-5"}
        disabled={disabled}
        aria-label={muted ? `${label} 소리 켜기` : `${label} 음소거`}
        aria-pressed={muted}
        onClick={onMute}
      >
        <Asset name={muted ? "sound-muted.svg" : "sound.svg"} />
      </button>
    </div>
  );
}
