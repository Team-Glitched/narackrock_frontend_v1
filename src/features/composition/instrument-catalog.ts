import definitions from "./instrument-catalog.json" with { type: "json" };

export type InstrumentDefinition = {
  id: string;
  label: string;
  kind: "pitched" | "drum";
  program: number;
  pitches?: number[];
  minPitch?: number;
  maxPitch?: number;
};

/** Sampled MIDI instruments; ids match the backend `InstrumentFamily` members. */
export const instruments = definitions as InstrumentDefinition[];

const aliases: Record<string, string> = {
  PIANO: "piano",
  ELECTRIC_PIANO: "electric-piano",
  ORGAN: "organ",
  NYLON_GUITAR: "nylon-guitar",
  GUITAR: "acoustic-guitar",
  ACOUSTIC_GUITAR: "acoustic-guitar",
  ELECTRIC_GUITAR: "electric-guitar",
  OVERDRIVE_GUITAR: "overdrive-guitar",
  DISTORTION_GUITAR: "distortion-guitar",
  ACOUSTIC_BASS: "acoustic-bass",
  BASS: "electric-bass",
  ELECTRIC_BASS: "electric-bass",
  PICKED_BASS: "picked-bass",
  SLAP_BASS: "slap-bass",
  SYNTH_BASS: "synth-bass",
  VIOLIN: "violin",
  HARP: "harp",
  STRINGS: "strings",
  TRUMPET: "trumpet",
  BRASS: "brass",
  SAXOPHONE: "saxophone",
  FLUTE: "flute",
  SYNTH_LEAD: "synth-lead",
  SYNTH_PAD: "synth-pad",
  MARIMBA: "marimba",
  DRUM: "drum-kit",
  DRUMS: "drum-kit",
  DRUM_KIT: "drum-kit",
  "피아노": "piano",
  "일렉피아노": "electric-piano",
  "오르간": "organ",
  "나일론기타": "nylon-guitar",
  "기타": "acoustic-guitar",
  "어쿠스틱기타": "acoustic-guitar",
  "통기타": "acoustic-guitar",
  "일렉기타": "electric-guitar",
  "베이스": "electric-bass",
  "바이올린": "violin",
  "하프": "harp",
  "스트링": "strings",
  "트럼펫": "trumpet",
  "브라스": "brass",
  "색소폰": "saxophone",
  "플루트": "flute",
  "신디사이저": "synth-lead",
  "마림바": "marimba",
  "드럼": "drum-kit",
};

const knownMidiIds = new Set(instruments.map((item) => item.id));

/** Maps legacy uppercase/Korean names to the backend's canonical ids, like `InstrumentFamily.normalize`. */
export function canonicalInstrumentId(value: string | null | undefined): string {
  const id = value?.trim() ?? "";
  if (!id) return "";
  const directAlias = aliases[id] ?? aliases[id.toUpperCase()] ?? aliases[id.replace(/\s+/g, "")];
  if (directAlias) return directAlias;
  const hyphenated = id.toLowerCase().replace(/[\s_]+/g, "-");
  if (knownMidiIds.has(hyphenated)) return hyphenated;
  return id;
}

/** The sampled instrument for a track, or undefined; unknown ids are never substituted with another sound. */
export function findInstrument(value: string | null | undefined): InstrumentDefinition | undefined {
  const id = canonicalInstrumentId(value);
  return instruments.find((item) => item.id === id);
}

export function samplePitches(instrument: InstrumentDefinition): number[] {
  if (instrument.kind === "pitched") return instrument.pitches ?? [];
  return Array.from(
    { length: (instrument.maxPitch ?? 81) - (instrument.minPitch ?? 35) + 1 },
    (_, index) => (instrument.minPitch ?? 35) + index,
  );
}

export function sampleUrls(instrument: InstrumentDefinition): Record<string, string> {
  return Object.fromEntries(samplePitches(instrument).map((pitch) => [String(pitch), `${pitch}.mp3`]));
}

/** Drum kits only accept General MIDI percussion keys 35–81, matching backend validation. */
export function invalidPitchesFor(instrument: InstrumentDefinition, pitches: number[]): number[] {
  if (instrument.kind !== "drum") return [];
  const min = instrument.minPitch ?? 35;
  const max = instrument.maxPitch ?? 81;
  return pitches.filter((pitch) => pitch < min || pitch > max);
}
