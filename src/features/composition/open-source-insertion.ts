import { getOpenSourcePlayback } from "../../lib/api/open-sources.ts";
import { projectPositionMs, type ClipLocalTiming } from "./clip-local-timing.ts";

/** Reads a source track duration in milliseconds, falling back to audio metadata when null. */
export async function openSourceDurationMs(openSourceId: number): Promise<number> {
  const playback = await getOpenSourcePlayback(openSourceId);
  if (playback.durationMs && playback.durationMs > 0) return playback.durationMs;
  const { promise, resolve, reject } = Promise.withResolvers<number>();
  const audio = new Audio();
  audio.preload = "metadata";
  audio.onloadedmetadata = () =>
    Number.isFinite(audio.duration) && audio.duration > 0
      ? resolve(Math.round(audio.duration * 1000))
      : reject(new Error("샘플 음원 길이를 확인하지 못했습니다."));
  audio.onerror = () => reject(new Error("샘플 음원을 불러오지 못했습니다."));
  audio.src = playback.audioUrl;
  return promise;
}

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
