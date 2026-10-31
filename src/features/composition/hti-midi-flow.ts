export type HtiMidiNote = {
  pitch: number;
  startTick: number;
  durationTick: number;
  velocity: number;
  effectType: string | null;
  effectParams: Record<string, unknown>;
};

export type HtiMidiResult = {
  durationTick: number;
  midiNotes: HtiMidiNote[];
};

export function createHtiMidiLayerPlan(result: HtiMidiResult, trackCount: number, maxTick: number) {
  if (
    !Number.isSafeInteger(result.durationTick) ||
    result.durationTick <= 0 ||
    result.durationTick > maxTick
  ) {
    throw new Error("변환된 녹음이 곡의 최대 길이를 초과했습니다.");
  }
  if (result.midiNotes.length === 0) {
    throw new Error("녹음에서 변환할 음정을 찾지 못했습니다. 반주 없이 다시 녹음해 주세요.");
  }
  return {
    name: `HTI MIDI ${trackCount + 1}`,
    instrument: "piano",
    sortOrder: trackCount,
    durationTick: result.durationTick,
    midiNotes: result.midiNotes,
  };
}
