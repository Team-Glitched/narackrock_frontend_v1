import groups from "./instrument-groups.json" with { type: "json" };
import { instruments, canonicalInstrumentId } from "./instrument-catalog.ts";

/** Instrument families exactly as the backend `InstrumentFamily` groups them. */
export const instrumentGroups = groups;
/** Audio-only recording roles; they are never valid for MIDI notes. */
export const recordedParts = [
  { id: "vocal", label: "메인 보컬" },
  { id: "backing-vocal", label: "코러스" },
  { id: "rap", label: "랩" },
  { id: "percussion", label: "타악기 녹음" },
  { id: "other", label: "기타 소리" },
];
export const instrumentParts = [...instruments, ...recordedParts];

export function partFor(value: string | null | undefined) {
  return instrumentParts.find((part) => part.id === canonicalInstrumentId(value));
}
export function partIdForValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const canonical = canonicalInstrumentId(trimmed);
  const direct = instrumentParts.find((part) => part.id === canonical);
  if (direct) return direct.id;
  const normalized = trimmed.toLowerCase();
  return instrumentParts.find((part) => part.label.toLowerCase() === normalized)?.id ?? null;
}
export function partLabel(value: string | null | undefined) {
  return partFor(value)?.label ?? value ?? "악기 선택";
}
export function partFamily(value: string | null | undefined) {
  const id = canonicalInstrumentId(value);
  return groups.find((group) => group.instruments.includes(id))?.id ?? null;
}
export function supportsMidi(value: string | null | undefined) {
  return instruments.some((instrument) => instrument.id === canonicalInstrumentId(value));
}

export type PartTrack = { trackId: number; instrument: string | null; approvalStatus: string; name: string };

/** Other layers using this family, for display only; sharing an instrument is allowed. */
export function tracksUsingInstrumentFamily(tracks: PartTrack[], value: string, currentTrackId?: number) {
  const family = partFamily(value);
  return family
    ? tracks.filter(
        (track) =>
          track.trackId !== currentTrackId &&
          track.approvalStatus !== "REJECTED" &&
          partFamily(track.instrument) === family,
      )
    : [];
}
