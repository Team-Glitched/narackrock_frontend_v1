export const SONG_TITLE_MAX_LENGTH = 40;
export const SOURCE_TITLE_MAX_LENGTH = 40;
export const SOURCE_DESCRIPTION_MAX_LENGTH = 500;

/** Counts Unicode code points (matching JVM `String.codePointCount`). */
export function codePointLength(value: string): number {
  let count = 0;
  for (let i = 0; i < value.length; ) {
    const code = value.codePointAt(i) ?? 0;
    count += 1;
    i += code > 0xffff ? 2 : 1;
  }
  return count;
}

/** Clamps a string to at most `max` Unicode code points without splitting surrogate pairs. */
export function clampCodePoints(value: string, max: number): string {
  if (max <= 0) return "";
  let count = 0;
  let end = 0;
  while (end < value.length && count < max) {
    const code = value.codePointAt(end) ?? 0;
    end += code > 0xffff ? 2 : 1;
    count += 1;
  }
  return value.slice(0, end);
}
