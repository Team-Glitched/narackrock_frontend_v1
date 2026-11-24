import type { TimeSignature } from "./time-signature.ts";

/** Project BPM and time signature (saved together). Pure: the app imports it too. */
export type ProjectTiming = { bpm: number; signature: TimeSignature };

export const timingDenominators = [1, 2, 4, 8, 16];

/** Backend timing limits: BPM 30–300, numerator 1–16, denominator 1/2/4/8/16. */
export function timingProblem({ bpm, signature }: ProjectTiming): string | null {
  if (!Number.isInteger(bpm) || bpm < 30 || bpm > 300)
    return "BPM은 30부터 300까지 입력할 수 있습니다.";
  if (!Number.isInteger(signature.numerator) || signature.numerator < 1 || signature.numerator > 16)
    return "마디당 박 수는 1부터 16까지입니다.";
  if (!timingDenominators.includes(signature.denominator))
    return "기준 음표는 1, 2, 4, 8, 16 중 하나여야 합니다.";
  return null;
}

/**
 * A timing field's typed text as the value to validate and apply. Never rounded, so `4.5` fails
 * validation instead of saving `5`; blank or non-numeric text is NaN, which fails too.
 */
export function timingFieldValue(text: string): number {
  return text.trim() === "" ? Number.NaN : Number(text);
}

/** The text a timing field shows: what the user typed while it still is the value, else the value (slider, reset). */
export function timingFieldText(draft: string | null, value: number): string {
  return draft !== null && Object.is(timingFieldValue(draft), value) ? draft : String(value);
}

/** The BPM slider's position for a typed BPM that may be out of range or not a number yet. */
export function timingSliderBpm(bpm: number): number {
  return Number.isFinite(bpm) ? Math.min(300, Math.max(30, bpm)) : 30;
}
