import type { MidiNoteDto } from "../../lib/api/composition.ts";
import { applyNoteEdit, type NoteBounds } from "./note-editing.ts";

export const basicDrumPads = [
  { pitch: 49, label: "크래시 심벌 1", icon: "crash-left" },
  { pitch: 57, label: "크래시 심벌 2", icon: "crash-right" },
  { pitch: 53, label: "라이드 안쪽 (벨)", icon: "ride-bell" },
  { pitch: 51, label: "라이드 바깥쪽 (보우)", icon: "ride-bow" },
  { pitch: 50, label: "하이 탐", icon: "tom-high" },
  { pitch: 47, label: "미드 탐", icon: "tom-mid" },
  { pitch: 41, label: "플로어 탐", icon: "tom-floor" },
  { pitch: 46, label: "오픈 하이햇", icon: "hihat-open" },
  { pitch: 42, label: "클로즈 하이햇", icon: "hihat-closed" },
  { pitch: 38, label: "스네어", icon: "snare" },
  { pitch: 36, label: "킥", icon: "kick" },
] as const;
export type DrumIconKind = (typeof basicDrumPads)[number]["icon"] | "percussion";
export type DrumPad = { pitch: number; label: string; icon: DrumIconKind };
export const basicDrumPitches: number[] = basicDrumPads.map((pad) => pad.pitch);
const percussionNames = [
  "어쿠스틱 베이스 드럼", "킥", "사이드 스틱", "스네어", "핸드 클랩", "일렉트릭 스네어",
  "플로어 탐", "클로즈 하이햇", "하이 플로어 탐", "페달 하이햇", "로우 탐", "오픈 하이햇",
  "미드 탐", "하이 미드 탐", "크래시 심벌 1", "하이 탐", "라이드 바깥쪽 (보우)",
  "차이니즈 심벌", "라이드 안쪽 (벨)", "탬버린", "스플래시 심벌", "카우벨", "크래시 심벌 2",
  "비브라슬랩", "라이드 심벌 2", "하이 봉고", "로우 봉고", "뮤트 하이 콩가", "오픈 하이 콩가",
  "로우 콩가", "하이 팀발레", "로우 팀발레", "하이 아고고", "로우 아고고", "카바사", "마라카스",
  "짧은 휘슬", "긴 휘슬", "짧은 귀로", "긴 귀로", "클라베", "하이 우드블록", "로우 우드블록",
  "뮤트 쿠이카", "오픈 쿠이카", "뮤트 트라이앵글", "오픈 트라이앵글",
] as const;
export const allDrumPads: DrumPad[] = Array.from({ length: 47 }, (_, row) => {
  const pitch = 81 - row;
  return basicDrumPads.find((pad) => pad.pitch === pitch) ?? {
    pitch, label: percussionNames[pitch - 35], icon: "percussion",
  };
});
export function drumPitches(expanded: boolean): number[] {
  return expanded ? allDrumPads.map((pad) => pad.pitch) : [...basicDrumPitches];
}
export function drumPadFor(pitch: number): DrumPad | undefined {
  return allDrumPads.find((pad) => pad.pitch === pitch);
}

/** Positive row deltas move down the visible kit, not chromatically. */
export function moveDrumNotes(notes: MidiNoteDto[], selected: ReadonlySet<number>, ticks: number,
  rowDelta: number, rows: readonly number[], bounds: NoteBounds): MidiNoteDto[] {
  return applyNoteEdit({ notes, selected: [...selected] }, {
    type: "move", indices: [...selected], deltaTick: Math.round(ticks), deltaRow: Math.round(rowDelta),
  }, { ...bounds, stepTick: 1, rows }).snapshot.notes;
}
