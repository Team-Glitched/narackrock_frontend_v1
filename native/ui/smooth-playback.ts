import { useLayoutEffect, useRef, useState } from "react";

import {
  anchoredPositionMs,
  nextPlaybackAnchor,
  playbackAnchorSettled,
  type PlaybackAnchor,
} from "../../src/lib/playback-progress.ts";
import { useScreen } from "./screen-context";

/**
 * Smoothly interpolates between the page's stepped position reports at the display frame rate while
 * `advancing` (the audio actually plays). The display never moves back within a playing stretch except
 * for a seek, shows the exact reported position otherwise, and does no frame work once it cannot move
 * or while its screen is not on display.
 */
export function useSmoothPlaybackMs(
  positionMs: number,
  durationMs: number | null,
  advancing: boolean,
): number {
  const { active } = useScreen();
  const running = advancing && active;
  const anchorRef = useRef<PlaybackAnchor | null>(null);
  const endRef = useRef(durationMs);
  const [shownMs, setShownMs] = useState(positionMs);

  useLayoutEffect(() => {
    endRef.current = durationMs;
  });

  useLayoutEffect(() => {
    const anchor = nextPlaybackAnchor(anchorRef.current, positionMs, running, performance.now());
    anchorRef.current = anchor;
    if (!running) return;
    setShownMs(anchoredPositionMs(anchor, anchor.atMs));
    let rafId = 0;
    const tick = () => {
      const now = performance.now();
      setShownMs(anchoredPositionMs(anchor, now));
      if (!playbackAnchorSettled(anchor, now, endRef.current)) rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [positionMs, running]);

  const ms = Math.max(0, running ? shownMs : positionMs);
  return durationMs !== null && durationMs > 0 ? Math.min(durationMs, ms) : ms;
}
