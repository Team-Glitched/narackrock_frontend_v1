import { beatIntervalMs } from "./metronome-timing.ts";

export const RECORD_COUNTDOWN_START = 3;

/** Beat interval in ms for the pre-record 3-2-1 countdown, synced to project timing. */
export function countdownBeatMs(bpm: number, timeSignature?: string): number {
  return beatIntervalMs(bpm, timeSignature);
}
