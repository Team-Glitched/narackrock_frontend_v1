import type { AudioSelection } from "@/features/composition/prepare-audio-file";

export const maxAudioClipMs = 60_000;
export const minAudioClipMs = 100;

const snap = (value: number) => Math.round(value / 100) * 100;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export function moveAudioSelection(
  selection: AudioSelection,
  deltaMs: number,
  durationMs: number,
): AudioSelection {
  const lengthMs = selection.endMs - selection.startMs;
  const startMs = clamp(snap(selection.startMs + deltaMs), 0, Math.max(0, durationMs - lengthMs));
  return { startMs, endMs: startMs + lengthMs };
}

export function resizeAudioSelectionStart(
  selection: AudioSelection,
  valueMs: number,
): AudioSelection {
  const startMs = clamp(
    snap(valueMs),
    Math.max(0, selection.endMs - maxAudioClipMs),
    selection.endMs - minAudioClipMs,
  );
  return { ...selection, startMs };
}

export function resizeAudioSelectionEnd(
  selection: AudioSelection,
  valueMs: number,
  durationMs: number,
): AudioSelection {
  const endMs = clamp(
    snap(valueMs),
    selection.startMs + minAudioClipMs,
    Math.min(durationMs, selection.startMs + maxAudioClipMs),
  );
  return { ...selection, endMs };
}

export function centerAudioSelection(
  selection: AudioSelection,
  centerMs: number,
  durationMs: number,
): AudioSelection {
  const lengthMs = selection.endMs - selection.startMs;
  const startMs = clamp(snap(centerMs - lengthMs / 2), 0, Math.max(0, durationMs - lengthMs));
  return { startMs, endMs: startMs + lengthMs };
}
