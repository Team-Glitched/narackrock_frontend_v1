import groups from "./instrument-groups.json" with { type: "json" };
import { instruments, canonicalInstrumentId } from "./instrument-catalog.ts";
import { INSTRUMENT_MAX_LENGTH, clampCodePoints } from "../../lib/content-limits.ts";

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

const partAliases: Record<string, string> = {
  VOCAL: "vocal",
  BACKING_VOCAL: "backing-vocal",
  RAP: "rap",
  PERCUSSION: "percussion",
  OTHER: "other",
  "보컬": "vocal",
  "메인보컬": "vocal",
  "코러스": "backing-vocal",
  "백킹보컬": "backing-vocal",
  "랩": "rap",
  "타악기": "percussion",
  "퍼커션": "percussion",
  "기타소리": "other",
};

function canonicalPartId(value: string | null | undefined): string {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return "";
  const canonicalMidi = canonicalInstrumentId(trimmed);
  if (canonicalMidi !== trimmed) return canonicalMidi;
  const compact = trimmed.replace(/\s+/g, "");
  const alias = partAliases[trimmed.toUpperCase()] ?? partAliases[compact];
  if (alias) return alias;
  const hyphenated = trimmed.toLowerCase().replace(/[\s_]+/g, "-");
  if (instrumentParts.some((part) => part.id === hyphenated)) return hyphenated;
  return canonicalMidi;
}

export function partFor(value: string | null | undefined) {
  const id = canonicalPartId(value);
  return instrumentParts.find((part) => part.id === id);
}
export function partIdForValue(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return null;
  const canonical = canonicalPartId(trimmed);
  const direct = instrumentParts.find((part) => part.id === canonical);
  if (direct) return direct.id;
  const normalized = trimmed.toLowerCase();
  const compact = normalized.replace(/\s+/g, "");
  return (
    instrumentParts.find(
      (part) =>
        part.label.toLowerCase() === normalized ||
        part.label.toLowerCase().replace(/\s+/g, "") === compact,
    )?.id ?? null
  );
}
export function partLabel(value: string | null | undefined) {
  return partFor(value)?.label ?? value ?? "악기 선택";
}

export function parseProfileInstruments(value: string | null | undefined): {
  selectedIds: string[];
  customLabels: string[];
} {
  const selectedIds: string[] = [];
  const customLabels: string[] = [];
  const seenIds = new Set<string>();
  const seenCustom = new Set<string>();
  for (const raw of value?.split(",") ?? []) {
    const token = raw.trim();
    if (!token) continue;
    const id = partIdForValue(token);
    if (id) {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        selectedIds.push(id);
      }
    } else if (!seenCustom.has(token)) {
      seenCustom.add(token);
      customLabels.push(token);
    }
  }
  return { selectedIds, customLabels };
}

export function formatProfileInstruments(
  selectedIds: readonly string[],
  customLabels: readonly string[] = [],
): string {
  const labels: string[] = [];
  const seen = new Set<string>();
  for (const id of selectedIds) {
    const label = partLabel(id);
    if (label && !seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  for (const custom of customLabels) {
    const trimmed = custom.trim();
    if (trimmed && !seen.has(trimmed)) {
      seen.add(trimmed);
      labels.push(trimmed);
    }
  }
  return clampCodePoints(labels.join(", "), INSTRUMENT_MAX_LENGTH);
}

export function profileInstrumentLabels(value: string | null | undefined): string[] {
  const { selectedIds, customLabels } = parseProfileInstruments(value);
  return [...selectedIds.map((id) => partLabel(id)), ...customLabels];
}

export function partFamily(value: string | null | undefined) {
  const id = canonicalPartId(value);
  return groups.find((group) => group.instruments.includes(id))?.id ?? null;
}
export function supportsMidi(value: string | null | undefined) {
  return instruments.some((instrument) => instrument.id === canonicalPartId(value));
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
