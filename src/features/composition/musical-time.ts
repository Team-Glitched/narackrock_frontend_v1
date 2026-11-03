export type TimeSignature = { timeSignatureNumerator: number; timeSignatureDenominator: number };
export type MusicalTiming = TimeSignature & { bpm: number };
export const timeSignatures = ["2/4", "3/4", "4/4", "5/4", "6/8", "7/8", "9/8", "12/8"];

export function meterTiming(ppq: number, numerator = 4, denominator = 4) {
  const beatTick = ppq * 4 / denominator;
  return { beatTick, barTick: beatTick * numerator };
}

export function rulerBeats(start: number, length: number, ppq: number, numerator = 4, denominator = 4) {
  const { beatTick, barTick } = meterTiming(ppq, numerator, denominator);
  return Array.from({ length: Math.ceil(length / beatTick) + 1 }, (_, i) => (Math.ceil(start / beatTick) + i) * beatTick)
    .filter(tick => tick < start + length)
    .map(tick => ({ tick, beat: Math.round(tick / beatTick) % numerator + 1,
      bar: Math.floor(tick / barTick) + 1, isBar: Math.round(tick / beatTick) % numerator === 0 }));
}
