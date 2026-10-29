import groups from "./instrument-groups.json" with { type: "json" };
import { instruments, canonicalInstrumentId } from "./instrument-catalog.ts";

export const instrumentGroups = groups;
const recordedParts = [
  { id: "vocal", label: "메인 보컬" }, { id: "backing-vocal", label: "코러스" },
  { id: "rap", label: "랩" }, { id: "percussion", label: "타악기 녹음" }, { id: "other", label: "기타 소리" },
];
export const instrumentParts = [...instruments, ...recordedParts];
export function partFor(value: string | null | undefined) {
  return instrumentParts.find(part => part.id === canonicalInstrumentId(value));
}
export function partLabel(value: string | null | undefined) { return partFor(value)?.label ?? value ?? "악기 선택"; }
export function partFamily(value: string | null | undefined) {
  const id = canonicalInstrumentId(value);
  return groups.find(group => group.instruments.includes(id))?.id ?? null;
}
export function supportsMidi(value: string | null | undefined) {
  return instruments.some(instrument => instrument.id === canonicalInstrumentId(value));
}
export type PartTrack = { trackId: number; instrument: string | null; approvalStatus: string; name: string };
export function occupyingTrack(tracks: PartTrack[], value: string, currentTrackId?: number) {
  const family = partFamily(value);
  return family ? tracks.find(track => track.trackId !== currentTrackId && track.approvalStatus !== "REJECTED"
    && partFamily(track.instrument) === family) : undefined;
}
