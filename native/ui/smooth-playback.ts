import { useEffect, useState } from "react";

type Anchor = { baseMs: number; atMs: number; playing: boolean };

/**
 * Smoothly interpolates between throttled native-bridge position updates at the display frame rate
 * without drifting past the next expected update when paused or buffering.
 */
export function useSmoothPlaybackMs(
  positionMs: number,
  durationMs: number | null,
  playing: boolean,
): number {
  const [sample, setSample] = useState<{ anchor: Anchor; nowMs: number }>(() => ({
    anchor: { baseMs: positionMs, atMs: 0, playing: false },
    nowMs: 0,
  }));

  useEffect(() => {
    const start = performance.now();
    const anchor: Anchor = { baseMs: positionMs, atMs: start, playing };
    let rafId = window.requestAnimationFrame(() => {
      setSample({ anchor, nowMs: performance.now() });
      if (!playing) return;
      const tick = () => {
        setSample({ anchor, nowMs: performance.now() });
        rafId = window.requestAnimationFrame(tick);
      };
      rafId = window.requestAnimationFrame(tick);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [positionMs, playing]);

  const elapsed =
    playing && sample.anchor.playing && sample.anchor.atMs > 0
      ? Math.min(350, Math.max(0, sample.nowMs - sample.anchor.atMs))
      : 0;
  const jumped = Math.abs(positionMs - sample.anchor.baseMs) > 350;
  const raw =
    !jumped && sample.anchor.atMs > 0 && playing && sample.anchor.playing
      ? sample.anchor.baseMs + elapsed
      : positionMs;
  const clamped = Math.max(0, raw);
  return durationMs !== null && durationMs > 0 ? Math.min(durationMs, clamped) : clamped;
}
