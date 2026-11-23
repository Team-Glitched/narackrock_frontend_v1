// Pure: shared by both the web editor, unit tests, and native screens (relative .ts imports only).
import { maxAudioClipMs, minAudioClipMs } from "./audio-trim-selection.ts";
import type { AudioClipSegment, AudioSelection } from "./prepare-audio-file.ts";
import {
  defaultSignature,
  signatureTiming,
  validSignature,
  type TimeSignature,
} from "./time-signature.ts";

export type SpliceSegment = {
  id: string;
  startMs: number;
  endMs: number;
};

export type BeatMark = {
  ms: number;
  bar: number;
  beat: number;
  isBar: boolean;
  label: string | null;
};

const snap = (value: number) => Math.round(value / 100) * 100;
const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value));

export function createInitialSegments(durationMs: number): SpliceSegment[] {
  const safeDuration = Number.isFinite(durationMs) && durationMs > 0 ? Math.floor(durationMs) : 100;
  return [{ id: "seg-1", startMs: 0, endMs: Math.max(1, Math.min(safeDuration, maxAudioClipMs)) }];
}

export function totalSegmentsMs(segments: readonly AudioClipSegment[]): number {
  return segments.reduce((sum, segment) => sum + Math.max(0, segment.endMs - segment.startMs), 0);
}

export function selectionFromSegments(segments: readonly AudioClipSegment[]): AudioSelection {
  if (!segments.length) return { startMs: 0, endMs: minAudioClipMs };
  const first = segments[0];
  if (segments.length === 1) {
    return { startMs: first.startMs, endMs: first.endMs };
  }
  return {
    startMs: first.startMs,
    endMs: segments[segments.length - 1].endMs,
    segments: segments.map(({ startMs, endMs }) => ({ startMs, endMs })),
  };
}

function minUnitFor(durationMs: number): number {
  return durationMs < minAudioClipMs ? Math.max(1, Math.floor(durationMs)) : minAudioClipMs;
}

/** Splits the segment containing `splitMs` (checking `preferredIndex` first) when both halves meet the minimum length. */
export function splitSegmentAt(
  segments: readonly SpliceSegment[],
  splitMs: number,
  nextId: string,
  preferredIndex?: number,
): { segments: SpliceSegment[]; selectedIndex: number } | null {
  if (!segments.length || !Number.isFinite(splitMs)) return null;
  const snapped = snap(splitMs);
  const canSplit = (seg: SpliceSegment) =>
    snapped >= seg.startMs + minAudioClipMs && snapped <= seg.endMs - minAudioClipMs;

  let targetIndex = -1;
  if (
    preferredIndex !== undefined &&
    preferredIndex >= 0 &&
    preferredIndex < segments.length &&
    canSplit(segments[preferredIndex])
  ) {
    targetIndex = preferredIndex;
  } else {
    targetIndex = segments.findIndex(canSplit);
  }
  if (targetIndex < 0) return null;

  const target = segments[targetIndex];
  const left: SpliceSegment = { ...target, endMs: snapped };
  const right: SpliceSegment = { id: nextId, startMs: snapped, endMs: target.endMs };
  const next = [
    ...segments.slice(0, targetIndex),
    left,
    right,
    ...segments.slice(targetIndex + 1),
  ];
  return { segments: next, selectedIndex: targetIndex + 1 };
}

/** Removes the selected segment so remaining segments stitch together seamlessly. */
export function deleteSegmentAt(
  segments: readonly SpliceSegment[],
  index: number,
): { segments: SpliceSegment[]; selectedIndex: number } | null {
  if (segments.length <= 1 || index < 0 || index >= segments.length) return null;
  const next = [...segments.slice(0, index), ...segments.slice(index + 1)];
  return { segments: next, selectedIndex: Math.min(index, next.length - 1) };
}

/** Duplicates the selected segment immediately after itself when total length stays within 60 seconds. */
export function duplicateSegmentAt(
  segments: readonly SpliceSegment[],
  index: number,
  nextId: string,
): { segments: SpliceSegment[]; selectedIndex: number } | null {
  if (index < 0 || index >= segments.length) return null;
  const target = segments[index];
  const segLen = target.endMs - target.startMs;
  if (segLen <= 0 || totalSegmentsMs(segments) + segLen > maxAudioClipMs) return null;
  const copy: SpliceSegment = { id: nextId, startMs: target.startMs, endMs: target.endMs };
  const next = [...segments.slice(0, index + 1), copy, ...segments.slice(index + 1)];
  return { segments: next, selectedIndex: index + 1 };
}

export function moveSegmentOrder(
  segments: readonly SpliceSegment[],
  index: number,
  direction: -1 | 1,
): { segments: SpliceSegment[]; selectedIndex: number } | null {
  const nextIndex = index + direction;
  if (index < 0 || index >= segments.length || nextIndex < 0 || nextIndex >= segments.length) {
    return null;
  }
  const next = [...segments];
  const [item] = next.splice(index, 1);
  next.splice(nextIndex, 0, item);
  return { segments: next, selectedIndex: nextIndex };
}

export function resizeSegmentStart(
  segments: readonly SpliceSegment[],
  index: number,
  valueMs: number,
  durationMs?: number,
): SpliceSegment[] {
  const current = segments[index];
  if (!current || !Number.isFinite(valueMs)) return [...segments];
  const otherTotal = totalSegmentsMs(segments) - (current.endMs - current.startMs);
  const maxSegmentLen = Math.max(1, maxAudioClipMs - otherTotal);
  const minUnit = minUnitFor(durationMs ?? current.endMs);
  const minStart = Math.max(0, current.endMs - maxSegmentLen);
  const maxStart = Math.max(minStart, current.endMs - minUnit);
  const startMs = clamp(snap(valueMs), minStart, maxStart);
  return segments.map((seg, i) => (i === index ? { ...seg, startMs } : seg));
}

export function resizeSegmentEnd(
  segments: readonly SpliceSegment[],
  index: number,
  valueMs: number,
  durationMs: number,
): SpliceSegment[] {
  const current = segments[index];
  if (!current || !Number.isFinite(valueMs)) return [...segments];
  const otherTotal = totalSegmentsMs(segments) - (current.endMs - current.startMs);
  const maxSegmentLen = Math.max(1, maxAudioClipMs - otherTotal);
  const minUnit = minUnitFor(durationMs);
  const minEnd = Math.min(durationMs, current.startMs + minUnit);
  const maxEnd = Math.max(minEnd, Math.min(durationMs, current.startMs + maxSegmentLen));
  const endMs = clamp(snap(valueMs), minEnd, maxEnd);
  return segments.map((seg, i) => (i === index ? { ...seg, endMs } : seg));
}

export function moveSegmentWindow(
  segments: readonly SpliceSegment[],
  index: number,
  deltaMs: number,
  durationMs: number,
): SpliceSegment[] {
  const current = segments[index];
  if (!current || !Number.isFinite(deltaMs)) return [...segments];
  const lengthMs = current.endMs - current.startMs;
  const startMs = clamp(snap(current.startMs + deltaMs), 0, Math.max(0, durationMs - lengthMs));
  const endMs = Math.min(durationMs, startMs + lengthMs);
  return segments.map((seg, i) => (i === index ? { ...seg, startMs, endMs } : seg));
}

/** Musical bar and beat ticks over `[0, durationMs]` using the song's BPM and time signature. */
export function beatMarksForDuration(
  durationMs: number,
  bpm: number,
  signature: TimeSignature = defaultSignature,
): { beatMs: number; barMs: number; totalBars: number; marks: BeatMark[] } {
  const safeSig = validSignature(signature) ? signature : defaultSignature;
  const safeBpm = Number.isFinite(bpm) ? clamp(bpm, 20, 300) : 120;
  const safeDuration = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 1000;
  const { beatMs } = signatureTiming(safeSig, safeBpm);
  const barMs = beatMs * safeSig.numerator;
  const totalBeats = Math.floor(safeDuration / beatMs);
  const totalBars = Math.max(1, Math.ceil(safeDuration / barMs));
  const barLabelStride = Math.max(1, Math.ceil(totalBars / 10));
  const includeSubBeats = totalBeats <= 96;

  const marks: BeatMark[] = [];
  for (let beatIndex = 0; beatIndex <= totalBeats; beatIndex += 1) {
    const ms = beatIndex * beatMs;
    if (ms > safeDuration) break;
    const bar = Math.floor(beatIndex / safeSig.numerator) + 1;
    const beatInBar = (beatIndex % safeSig.numerator) + 1;
    const isBar = beatInBar === 1;
    if (!isBar && !includeSubBeats) continue;
    const showLabel = isBar && (bar - 1) % barLabelStride === 0;
    marks.push({
      ms,
      bar,
      beat: beatInBar,
      isBar,
      label: showLabel ? String(bar) : null,
    });
  }
  return { beatMs, barMs, totalBars, marks };
}

/** Maps elapsed spliced playback time back to `{ segmentIndex, sourceMs }`. */
export function splicedTimelinePosition(
  segments: readonly AudioClipSegment[],
  elapsedMs: number,
): { segmentIndex: number; sourceMs: number } {
  if (!segments.length) return { segmentIndex: 0, sourceMs: 0 };
  const clamped = Math.max(0, elapsedMs);
  let acc = 0;
  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    const segLen = Math.max(0, segment.endMs - segment.startMs);
    if (clamped <= acc + segLen || index === segments.length - 1) {
      const within = Math.min(segLen, clamped - acc);
      return { segmentIndex: index, sourceMs: segment.startMs + within };
    }
    acc += segLen;
  }
  const last = segments[segments.length - 1];
  return { segmentIndex: segments.length - 1, sourceMs: last.endMs };
}
