import { projectPositionMs, type ClipLocalTiming } from "./clip-local-timing.ts";

/** Convert the visible clip-local cursor to the shared project timeline. */
export function openSourceStartTick(positionTick: number, timing: ClipLocalTiming, projectMaxTick: number): number {
  return Math.min(projectMaxTick - 1, Math.max(0, Math.round(projectPositionMs(positionTick, timing) / timing.tickMs)));
}

/** A confirmed insertion must never be offered again just because its follow-up read failed. */
export async function insertThenRefresh(insert: () => Promise<unknown>, refresh: () => Promise<unknown>): Promise<boolean> {
  await insert();
  try {
    await refresh();
    return true;
  } catch {
    return false;
  }
}
