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

export function instrumentFor(value: string | null | undefined): InstrumentDefinition {
  const id = value?.trim() ?? "";
  return instruments.find((item) => item.id === (aliases[id] ?? id)) ?? instruments[0];
}

export function samplePitches(instrument: InstrumentDefinition): number[] {
  if (instrument.kind === "pitched") return instrument.pitches ?? [];
  return Array.from({ length: (instrument.maxPitch ?? 81) - (instrument.minPitch ?? 35) + 1 },
    (_, index) => (instrument.minPitch ?? 35) + index);
}

export function sampleUrls(instrument: InstrumentDefinition): Record<string, string> {
  return Object.fromEntries(samplePitches(instrument).map((pitch) =>
    [String(pitch), `${pitch}.mp3`]));
}

export const drumNames: Record<number, string> = {
  35: "어쿠스틱 킥", 36: "킥", 37: "림샷", 38: "스네어", 39: "클랩",
  40: "일렉 스네어", 41: "로우 탐", 42: "닫힌 하이햇", 43: "로우 탐",
  44: "페달 하이햇", 45: "미드 탐", 46: "열린 하이햇", 47: "미드 탐",
  48: "하이 탐", 49: "크래시", 50: "하이 탐", 51: "라이드", 52: "차이나 심벌",
  53: "라이드 벨", 54: "탬버린", 55: "스플래시", 56: "카우벨", 57: "크래시 2",
  59: "라이드 2", 60: "하이 봉고", 61: "로우 봉고", 62: "뮤트 콩가",
  63: "하이 콩가", 64: "로우 콩가", 65: "하이 팀발레스", 66: "로우 팀발레스",
  67: "하이 아고고", 68: "로우 아고고", 69: "카바사", 70: "마라카스",
  71: "짧은 휘슬", 72: "긴 휘슬", 73: "짧은 귀로", 74: "긴 귀로",
  75: "클라베", 76: "하이 우드블록", 77: "로우 우드블록",
  78: "뮤트 쿠이카", 79: "오픈 쿠이카", 80: "뮤트 트라이앵글", 81: "오픈 트라이앵글",
};
