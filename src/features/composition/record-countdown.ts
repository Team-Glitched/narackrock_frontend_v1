import { beatIntervalMs } from "./metronome-timing.ts";

export const RECORD_COUNTDOWN_START = 3;

/** Beat interval in ms for the pre-record 3-2-1 countdown, synced to project timing. */
export function countdownBeatMs(bpm: number, timeSignature?: string): number {
  return beatIntervalMs(bpm, timeSignature);
}

/** The count-in counts beats (150 ms to 24 s each at supported timings), never seconds. */
export function countdownCaption(beatsRemaining: number): string {
  return `녹음 시작까지 ${beatsRemaining}박`;
}

export const RECORD_START_FAILED = "마이크를 사용할 수 없어 녹음을 시작하지 못했습니다. 다시 시도해 주세요.";

/**
 * Starts the web recorder once the count-in ends. The microphone can disappear during the count-in
 * (unplugged, revoked, taken by another app), so a dead stream or a throwing `start()` releases the
 * stream and returns the error to show instead of leaving the screen idle without feedback.
 */
export function startRecorderAfterCountIn(
  recorder: Pick<MediaRecorder, "start">,
  stream: Pick<MediaStream, "active" | "getTracks">,
): string | null {
  const release = () => stream.getTracks().forEach((track) => track.stop());
  if (!stream.active || stream.getTracks().some((track) => track.readyState === "ended")) {
    release();
    return RECORD_START_FAILED;
  }
  try {
    recorder.start();
    return null;
  } catch {
    release();
    return RECORD_START_FAILED;
  }
}

/**
 * The app rechecks before dispatching Start: a long count-in can outlive the screen, the
 * foreground, or the microphone permission. Returns null to start, "" to cancel silently (the
 * user left), or the error to show.
 */
export async function nativeCountInBlocker(gate: {
  screenActive: () => boolean;
  appActive: () => boolean;
  microphoneGranted: () => Promise<boolean>;
}): Promise<string | null> {
  if (!gate.screenActive() || !gate.appActive()) return "";
  const granted = await gate.microphoneGranted().catch(() => false);
  if (!gate.screenActive() || !gate.appActive()) return "";
  return granted ? null : "마이크 권한을 확인해 주세요.";
}
