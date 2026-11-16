import type { MidiNoteDto } from "../../lib/api/composition.ts";

const maxBytes = 1024 * 1024;
const filePpq = 480;

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

export function positionJsonNotes(notes: MidiNoteDto[], projectPpq: number, afterTick: number): MidiNoteDto[] {
  const ratio = projectPpq / filePpq;
  return notes.map((note) => ({
    ...note,
    startTick: afterTick + Math.round(note.startTick * ratio),
    durationTick: Math.max(1, Math.round(note.durationTick * ratio)),
  }));
}
