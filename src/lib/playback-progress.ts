/**
 * Playback positions of the players' seek bars. While the audio advances the hidden web page reports
 * its position to the app in steps, so a playing player resends its screen at most 4 times a second;
 * the native screen interpolates between reports at the display frame rate (native/ui/smooth-playback.ts).
 */

/** Step of the positions reported while the audio advances. */
export const PLAYBACK_REPORT_STEP_MS = 250;

/**
 * How far the native display runs ahead of the last report: covers one late or skipped report, and
 * reports more than this far behind the display are seeks.
 */
export const PLAYBACK_MAX_AHEAD_MS = 2 * PLAYBACK_REPORT_STEP_MS;

/**
 * The position a page reports: rounded down to the step while the audio advances, exact otherwise
 * (paused, seeked, ended, or a start still loading), so a paused bar shows exactly where it stopped.
 */
export function reportedPositionMs(positionMs: number, advancing: boolean): number {
  return advancing
    ? Math.floor(positionMs / PLAYBACK_REPORT_STEP_MS) * PLAYBACK_REPORT_STEP_MS
    : positionMs;
}

/**
 * A report as the native display interpolates it: `baseMs` reported at `atMs` (a monotonic clock in
 * ms), never shown below `floorMs`. Not `advancing`: the display is `baseMs` exactly.
 */
export type PlaybackAnchor = { baseMs: number; atMs: number; floorMs: number; advancing: boolean };

/** The displayed position of `anchor` at `nowMs`. */
export function anchoredPositionMs(anchor: PlaybackAnchor, nowMs: number): number {
  if (!anchor.advancing) return anchor.baseMs;
  const elapsed = Math.min(PLAYBACK_MAX_AHEAD_MS, Math.max(0, nowMs - anchor.atMs));
  return Math.max(anchor.floorMs, anchor.baseMs + elapsed);
}

/**
 * Anchors a new report at `nowMs`. While advancing, a report slightly behind the current display (a
 * stepped or late report, or the step-rounded position of a resumed start) holds the display until the
 * report catches up instead of moving it back; a report further behind is a seek and shows at once.
 */
export function nextPlaybackAnchor(
  previous: PlaybackAnchor | null,
  positionMs: number,
  advancing: boolean,
  nowMs: number,
): PlaybackAnchor {
  const shown = previous ? anchoredPositionMs(previous, nowMs) : positionMs;
  const behind = shown - positionMs;
  const hold = advancing && behind > 0 && behind <= PLAYBACK_MAX_AHEAD_MS;
  return { baseMs: positionMs, atMs: nowMs, floorMs: hold ? shown : positionMs, advancing };
}

/** The display of `anchor` no longer moves after `nowMs`: extrapolation reached its cap or `endMs`. */
export function playbackAnchorSettled(
  anchor: PlaybackAnchor,
  nowMs: number,
  endMs: number | null,
): boolean {
  if (!anchor.advancing || nowMs - anchor.atMs >= PLAYBACK_MAX_AHEAD_MS) return true;
  return endMs !== null && endMs > 0 && anchoredPositionMs(anchor, nowMs) >= endMs;
}

/** Arrow keys move a seek bar this far (the bars are continuous, `step="any"`, for a smooth thumb). */
const KEYBOARD_SEEK_STEP_MS = 100;

/**
 * The position an arrow key moves a seek bar to, within 0–`durationMs`; `null` for other keys, which
 * keep the range input's own behavior. A continuous range input would move 1% of its range instead.
 */
export function keyboardSeekMs(key: string, positionMs: number, durationMs: number): number | null {
  const direction =
    key === "ArrowRight" || key === "ArrowUp" ? 1 : key === "ArrowLeft" || key === "ArrowDown" ? -1 : 0;
  if (direction === 0) return null;
  return Math.min(durationMs, Math.max(0, positionMs + direction * KEYBOARD_SEEK_STEP_MS));
}
