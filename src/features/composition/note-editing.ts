import type { MidiNoteDto } from "../../lib/api/composition.ts";

export type NoteBounds = { maxTick: number; minPitch: number; maxPitch: number };
export type NoteEditBounds = NoteBounds & { stepTick: number; rows: readonly number[] };
export type NoteEditorSnapshot = { notes: MidiNoteDto[]; selected: number[] };
export type NoteEditCommand =
  | { type: "insert"; notes: MidiNoteDto[] }
  | { type: "delete"; indices: readonly number[] }
  | { type: "move"; indices: readonly number[]; deltaTick: number; deltaRow: number }
  | { type: "resize"; indices: readonly number[]; deltaTick: number }
  | { type: "replace"; index: number; note: MidiNoteDto }
  | { type: "paste"; notes: MidiNoteDto[]; atTick: number }
  | { type: "duplicate"; indices: readonly number[] };
export type NoteEditResult = {
  snapshot: NoteEditorSnapshot;
  indexMap: Array<number | null>;
  changed: boolean;
  error: string | null;
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
export const pitchName = (pitch: number) =>
  `${["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"][pitch % 12]}${Math.floor(pitch / 12) - 1}`;
export const notesOverlap = (a: MidiNoteDto, b: MidiNoteDto) =>
  a.pitch === b.pitch && a.startTick < b.startTick + b.durationTick &&
  a.startTick + a.durationTick > b.startTick;

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (!a || !b || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length &&
      a.every((value, index) => sameValue(value, b[index]));
  }
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length &&
    keys.every((key) => Object.hasOwn(right, key) && sameValue(left[key], right[key]));
}
export const sameNotes = (a: readonly MidiNoteDto[], b: readonly MidiNoteDto[]) =>
  a === b || (a.length === b.length && a.every((note, index) => sameValue(note, b[index])));

/** Validate all candidates, including velocity and existing imported notes, before any write. */
export function validateNotes(notes: readonly MidiNoteDto[], bounds: NoteBounds): string | null {
  if (!Number.isSafeInteger(bounds.maxTick) || bounds.maxTick < 0 ||
      !Number.isInteger(bounds.minPitch) || !Number.isInteger(bounds.maxPitch) ||
      bounds.minPitch < 0 || bounds.maxPitch > 127 || bounds.minPitch > bounds.maxPitch)
    return "편집 가능한 음역 또는 곡 길이가 올바르지 않습니다.";
  if (notes.length > 10_000) return "노트는 최대 10,000개까지 추가할 수 있습니다.";
  const byPitch = new Map<number, MidiNoteDto[]>();
  for (const note of notes) {
    if (!Number.isInteger(note.pitch) || note.pitch < bounds.minPitch || note.pitch > bounds.maxPitch)
      return "이 악기에서 지원하지 않는 음입니다.";
    if (!Number.isInteger(note.velocity) || note.velocity < 0 || note.velocity > 127)
      return "노트 세기는 0~127 사이의 정수여야 합니다.";
    if (!Number.isSafeInteger(note.startTick) || note.startTick < 0 ||
        !Number.isSafeInteger(note.durationTick) || note.durationTick <= 0 ||
        !Number.isSafeInteger(note.startTick + note.durationTick) ||
        note.startTick + note.durationTick > bounds.maxTick)
      return "노트가 곡의 최대 길이를 벗어나거나 길이가 올바르지 않습니다.";
    const group = byPitch.get(note.pitch);
    if (group) group.push(note);
    else byPitch.set(note.pitch, [note]);
  }
  for (const group of byPitch.values()) {
    group.sort((a, b) => a.startTick - b.startTick);
    for (let i = 1; i < group.length; i++) {
      if (notesOverlap(group[i - 1], group[i])) return "같은 음의 노트가 겹칩니다.";
    }
  }
  return null;
}

export function canPlaceNotes(existing: MidiNoteDto[], added: MidiNoteDto[], bounds: NoteBounds) {
  return validateNotes([...existing, ...added], bounds) === null;
}

export function copyNotes(notes: MidiNoteDto[], selected: ReadonlySet<number>): MidiNoteDto[] {
  const picked = notes.filter((_, index) => selected.has(index));
  if (!picked.length) return [];
  const origin = Math.min(...picked.map((note) => note.startTick));
  return picked.map((note) => ({ ...structuredClone(note), startTick: note.startTick - origin }));
}

/** Retain one common displacement for a whole group; never clamp its notes independently. */
export function moveNotes(notes: MidiNoteDto[], selected: ReadonlySet<number>, ticks: number,
  pitches: number, bounds: NoteBounds): MidiNoteDto[] {
  const picked = notes.filter((_, index) => selected.has(index));
  if (!picked.length || !Number.isFinite(ticks) || !Number.isFinite(pitches)) return notes;
  const dx = clamp(Math.round(ticks), -Math.min(...picked.map((n) => n.startTick)),
    bounds.maxTick - Math.max(...picked.map((n) => n.startTick + n.durationTick)));
  const dy = clamp(Math.round(pitches), bounds.minPitch - Math.min(...picked.map((n) => n.pitch)),
    bounds.maxPitch - Math.max(...picked.map((n) => n.pitch)));
  const next = notes.map((note, index) => selected.has(index)
    ? { ...note, startTick: note.startTick + dx, pitch: note.pitch + dy } : note);
  return validateNotes(next, bounds) === null ? next : notes;
}

export function resizeNotes(notes: MidiNoteDto[], selected: ReadonlySet<number>, ticks: number,
  minTick: number, bounds: NoteBounds): MidiNoteDto[] {
  const picked = notes.filter((_, index) => selected.has(index));
  if (!picked.length || !Number.isFinite(ticks) || !Number.isSafeInteger(minTick) || minTick < 1) return notes;
  const minimum = Math.min(...picked.map((note) => note.durationTick));
  const delta = clamp(Math.round(ticks), Math.min(minTick, minimum) - minimum,
    Math.min(...picked.map((note) => bounds.maxTick - note.startTick - note.durationTick)));
  const next = notes.map((note, index) => selected.has(index)
    ? { ...note, durationTick: note.durationTick + delta } : note);
  return validateNotes(next, bounds) === null ? next : notes;
}

/** Find the first whole-group placement by advancing past actual blocking intervals. */
export function pasteNotes(notes: MidiNoteDto[], clipboard: MidiNoteDto[], at: number,
  bounds: NoteBounds): MidiNoteDto[] {
  if (!clipboard.length || !Number.isFinite(at) || notes.length + clipboard.length > 10_000 ||
      validateNotes(clipboard, bounds) !== null) return notes;
  const span = Math.max(...clipboard.map((note) => note.startTick + note.durationTick));
  if (span > bounds.maxTick) return notes;
  let origin = clamp(Math.round(at), 0, bounds.maxTick - span);
  while (origin + span <= bounds.maxTick) {
    let nextOrigin = origin;
    for (const source of clipboard) {
      const placed = { ...source, startTick: origin + source.startTick };
      for (const existing of notes) {
        if (notesOverlap(placed, existing)) nextOrigin = Math.max(nextOrigin,
          existing.startTick + existing.durationTick - source.startTick);
      }
    }
    if (nextOrigin === origin) {
      const next = [...notes, ...clipboard.map((note) => ({
        ...structuredClone(note), startTick: origin + note.startTick,
      }))];
      return validateNotes(next, bounds) === null ? next : notes;
    }
    origin = nextOrigin;
  }
  return notes;
}

export function validSelection(indices: readonly number[], count: number): number[] {
  return [...new Set(indices.filter((index) => Number.isSafeInteger(index) && index >= 0 && index < count))];
}

export function applyNoteEdit(snapshot: NoteEditorSnapshot, command: NoteEditCommand,
  bounds: NoteEditBounds): NoteEditResult {
  const identity = snapshot.notes.map((_, index) => index);
  const reject = (error: string): NoteEditResult => ({ snapshot, indexMap: identity, changed: false, error });
  const notes = snapshot.notes;
  let next: MidiNoteDto[] = notes;
  let selected = validSelection(snapshot.selected, notes.length);
  let indexMap: Array<number | null> = identity;
  if (!Number.isSafeInteger(bounds.stepTick) || bounds.stepTick < 1)
    return reject("스냅 길이가 올바르지 않습니다.");
  if ("indices" in command && command.indices.some((index) =>
    !Number.isSafeInteger(index) || index < 0 || index >= notes.length))
    return reject("선택한 노트를 찾을 수 없습니다.");
  switch (command.type) {
    case "insert": {
      if (!command.notes.length) return reject("추가할 노트가 없습니다.");
      next = [...notes, ...structuredClone(command.notes)];
      selected = command.notes.map((_, index) => notes.length + index);
      break;
    }
    case "delete": {
      const removed = new Set(command.indices);
      let survivor = 0;
      indexMap = notes.map((_, index) => removed.has(index) ? null : survivor++);
      next = notes.filter((_, index) => !removed.has(index));
      selected = selected.flatMap((index) => indexMap[index] === null ? [] : [indexMap[index]!]);
      break;
    }
    case "move": {
      if (!Number.isSafeInteger(command.deltaTick) || !Number.isSafeInteger(command.deltaRow))
        return reject("이동량은 정수여야 합니다.");
      const indices = new Set(command.indices);
      const picked = notes.filter((_, index) => indices.has(index));
      if (!picked.length) return reject("이동할 노트를 선택해주세요.");
      const dx = clamp(command.deltaTick, -Math.min(...picked.map((note) => note.startTick)),
        bounds.maxTick - Math.max(...picked.map((note) => note.startTick + note.durationTick)));
      const rows = picked.map((note) => bounds.rows.indexOf(note.pitch));
      if (command.deltaRow && rows.some((row) => row < 0))
        return reject("숨은 드럼 노트를 이동하려면 전체 키트로 전환해주세요.");
      const dy = command.deltaRow ? clamp(command.deltaRow, -Math.min(...rows),
        bounds.rows.length - 1 - Math.max(...rows)) : 0;
      next = notes.map((note, index) => indices.has(index) ? {
        ...note, startTick: note.startTick + dx,
        pitch: dy ? bounds.rows[bounds.rows.indexOf(note.pitch) + dy] : note.pitch,
      } : note);
      break;
    }
    case "resize": {
      if (!Number.isSafeInteger(command.deltaTick)) return reject("길이 변경량은 정수여야 합니다.");
      const indices = new Set(command.indices);
      const picked = notes.filter((_, index) => indices.has(index));
      if (!picked.length) return reject("길이를 변경할 노트를 선택해주세요.");
      const minimum = Math.min(...picked.map((note) => note.durationTick));
      const delta = clamp(command.deltaTick, Math.min(bounds.stepTick, minimum) - minimum,
        Math.min(...picked.map((note) => bounds.maxTick - note.startTick - note.durationTick)));
      next = notes.map((note, index) => indices.has(index)
        ? { ...note, durationTick: note.durationTick + delta } : note);
      break;
    }
    case "replace": {
      if (!Number.isSafeInteger(command.index) || !notes[command.index])
        return reject("변경할 노트를 찾을 수 없습니다.");
      next = notes.map((note, index) => index === command.index ? structuredClone(command.note) : note);
      break;
    }
    case "paste": {
      if (!Number.isFinite(command.atTick)) return reject("붙여넣기 위치가 올바르지 않습니다.");
      const atTick = Math.max(0, Math.floor(command.atTick / bounds.stepTick + 1e-9) * bounds.stepTick);
      const clipboard = copyNotes(command.notes, new Set(command.notes.map((_, index) => index)));
      next = pasteNotes(notes, clipboard, atTick, bounds);
      if (next === notes) return reject("선택한 노트 전체를 붙여넣을 공간이 없습니다.");
      selected = next.slice(notes.length).map((_, index) => notes.length + index);
      break;
    }
    case "duplicate": {
      const indices = new Set(command.indices);
      const picked = notes.filter((_, index) => indices.has(index));
      if (!picked.length) return reject("복제할 노트를 선택해주세요.");
      const atTick = Math.max(...picked.map((note) => note.startTick + note.durationTick));
      const clipboard = copyNotes(notes, indices);
      const span = Math.max(...clipboard.map((note) => note.startTick + note.durationTick));
      if (atTick + span > bounds.maxTick) return reject("선택한 노트 전체를 복제할 공간이 없습니다.");
      next = pasteNotes(notes, clipboard, atTick, bounds);
      if (next === notes) return reject("선택한 노트 전체를 복제할 공간이 없습니다.");
      selected = next.slice(notes.length).map((_, index) => notes.length + index);
      break;
    }
  }
  const error = validateNotes(next, bounds);
  if (error) return reject(error);
  if (sameNotes(notes, next)) return reject("변경할 내용이 없습니다.");
  return { snapshot: { notes: next, selected }, indexMap, changed: true, error: null };
}
