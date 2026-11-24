import type { MidiNoteDto } from "../../lib/api/composition.ts";
import { validateNotes, type NoteBounds, type NoteEditCommand } from "./note-editing.ts";

const maxBytes = 1024 * 1024;
const filePpq = 480;

/** The accepted file layout, shown on the upload tab (web and app). */
export const jsonNoteFormat =
  "schemaVersion 1, ppq 480, midiNotes 배열(pitch·startTick·durationTick·velocity 정수)";

function isInteger(value: unknown, min: number, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

export async function readJsonNotes(file: File): Promise<MidiNoteDto[]> {
  if (!/\.json$/i.test(file.name)) throw new Error("JSON 음표 파일(.json)을 선택해 주세요.");
  if (file.size > maxBytes) throw new Error("1 MiB 이하의 파일을 선택해 주세요.");

  let data: { schemaVersion?: unknown; ppq?: unknown; midiNotes?: unknown } | null;
  try {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()).trim();
    // Accept a JSON block copied from Markdown, including a missing closing fence.
    const fenced = /^```(?:json)?[\t ]*\r?\n([\s\S]*?)(?:\r?\n```)?$/i.exec(source);
    data = JSON.parse(fenced?.[1] ?? source);
  } catch {
    throw new Error("UTF-8 JSON 파일을 읽을 수 없습니다.");
  }
  if (data?.schemaVersion !== 1 || data.ppq !== filePpq)
    throw new Error("schemaVersion은 1, ppq는 480이어야 합니다.");
  if (!Array.isArray(data.midiNotes) || !data.midiNotes.length || data.midiNotes.length > 10_000)
    throw new Error("midiNotes에는 음표가 1~10,000개 있어야 합니다.");

  return data.midiNotes.map((note, index) => {
    const fields = (note ?? {}) as Record<string, unknown>;
    const { pitch, startTick, durationTick, velocity } = fields;
    if (!isInteger(pitch, 0, 127)) throw new Error(`midiNotes[${index}].pitch는 0~127 정수여야 합니다.`);
    if (!isInteger(startTick, 0)) throw new Error(`midiNotes[${index}].startTick은 0 이상의 정수여야 합니다.`);
    if (!isInteger(durationTick, 1) || !Number.isSafeInteger(startTick + durationTick))
      throw new Error(`midiNotes[${index}].durationTick 또는 음표 끝 위치가 올바르지 않습니다.`);
    if (!isInteger(velocity, 1, 127)) throw new Error(`midiNotes[${index}].velocity는 1~127 정수여야 합니다.`);
    return { pitch, startTick, durationTick, velocity, effectType: null, effectParams: {} };
  });
}

/**
 * Converts source ticks from `sourcePpq` to the project's ppq after `afterTick`. Start and end are
 * rounded, and the length is their difference, so back-to-back notes of one pitch stay adjacent
 * instead of overlapping by a rounded tick.
 */
export function positionMidiNotes(
  notes: MidiNoteDto[],
  sourcePpq: number,
  projectPpq: number,
  afterTick: number,
): MidiNoteDto[] {
  const ratio = projectPpq / Math.max(1, sourcePpq);
  return notes.map((note) => {
    const start = Math.round(note.startTick * ratio);
    const end = Math.round((note.startTick + note.durationTick) * ratio);
    return { ...note, startTick: afterTick + start, durationTick: Math.max(1, end - start) };
  });
}

/**
 * Converts file ticks to the project's ppq after `afterTick`. Start and end are rounded, and the
 * length is their difference, so back-to-back notes of one pitch stay adjacent instead of
 * overlapping by a rounded tick.
 */
export function positionJsonNotes(notes: MidiNoteDto[], projectPpq: number, afterTick: number): MidiNoteDto[] {
  return positionMidiNotes(notes, filePpq, projectPpq, afterTick);
}

/**
 * Reads a JSON note file and adds its notes after the last note of the edited clip as one edit.
 * Throws with the reason when the file or a note is invalid; nothing is added then.
 */
export async function importJsonNoteFile(
  editor: {
    snapshot: { notes: MidiNoteDto[] };
    bounds: NoteBounds;
    execute: (command: NoteEditCommand) => boolean;
  },
  file: File,
  projectPpq: number,
): Promise<void> {
  const imported = await readJsonNotes(file);
  const existing = editor.snapshot.notes;
  const afterTick = existing.reduce((end, note) => Math.max(end, note.startTick + note.durationTick), 0);
  const positioned = positionJsonNotes(imported, projectPpq, afterTick);
  const issue = validateNotes([...existing, ...positioned], editor.bounds);
  if (issue) throw new Error(issue);
  if (!editor.execute({ type: "insert", notes: positioned }))
    throw new Error("음표를 추가하지 못했습니다. 현재 편집 상태를 확인해 주세요.");
}
