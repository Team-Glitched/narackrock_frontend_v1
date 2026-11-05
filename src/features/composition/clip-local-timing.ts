export type ClipLocalTiming = {
  tickMs: number;
  clipStartMs: number;
  maxTick: number;
};

/** Piano-roll ticks are relative to the clip, while playback seeks use project milliseconds. */
export function clipLocalTiming(
  bpm: number,
  ppq: number,
  projectMaxTick: number,
  clipStartTick: number,
): ClipLocalTiming {
  const tickMs = 60000 / (bpm * ppq);
  return {
    tickMs,
    clipStartMs: clipStartTick * tickMs,
    maxTick: Math.max(0, projectMaxTick - clipStartTick),
  };
}

export function clipPositionTick(positionMs: number, timing: ClipLocalTiming): number {
  return Math.min(timing.maxTick, Math.max(0, (positionMs - timing.clipStartMs) / timing.tickMs));
}

export function projectPositionMs(tick: number, timing: ClipLocalTiming): number {
  return timing.clipStartMs + Math.min(timing.maxTick, Math.max(0, tick)) * timing.tickMs;
}
