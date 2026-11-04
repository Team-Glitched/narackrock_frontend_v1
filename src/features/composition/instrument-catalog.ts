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
  "피아노": "piano",
  GUITAR: "acoustic-guitar",
  "기타": "acoustic-guitar",
  BASS: "electric-bass",
  "베이스": "electric-bass",
  DRUM: "drum-kit",
  DRUMS: "drum-kit",
  "드럼": "drum-kit",
};

/** Maps legacy uppercase/Korean names to the backend's canonical ids, like `InstrumentFamily.normalize`. */
export function canonicalInstrumentId(value: string | null | undefined): string {
  const id = value?.trim() ?? "";
  return aliases[id] ?? aliases[id.toUpperCase()] ?? id;
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
