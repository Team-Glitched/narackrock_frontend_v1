export const NICKNAME_MAX_LENGTH = 20;
export const PROFILE_BIO_MAX_LENGTH = 200;
export const INSTRUMENT_MAX_LENGTH = 250;

export const COMMUNITY_NAME_MIN_LENGTH = 2;
export const COMMUNITY_NAME_MAX_LENGTH = 20;
export const COMMUNITY_DESCRIPTION_MAX_LENGTH = 500;

export const SONG_TITLE_MAX_LENGTH = 40;
export const SOURCE_TITLE_MAX_LENGTH = 40;
export const SOURCE_DESCRIPTION_MAX_LENGTH = 500;

export const POST_TITLE_MAX_LENGTH = 40;
export const POST_CONTENT_MAX_LENGTH = 5000;

export const COMMENT_MAX_LENGTH = 3000;
export const CHAT_MESSAGE_MAX_LENGTH = 2000;

export const CONTRIBUTION_COMMENT_MAX_LENGTH = 120;
export const MODERATION_REASON_MAX_LENGTH = 500;
export const REPORT_DESCRIPTION_MAX_LENGTH = 1000;
export const SEARCH_QUERY_MAX_LENGTH = 100;

const EMOJI_BASE_RE = (() => {
  try {
    return new RegExp("\\p{Extended_Pictographic}", "u");
  } catch {
    return /[\u{1F000}-\u{1FAFF}\u2600-\u27BF]/u;
  }
})();

const COMBINING_MARK_RE = (() => {
  try {
    return new RegExp("^\\p{Mark}$", "u");
  } catch {
    return null;
  }
})();

function toCodePoints(value: string): number[] {
  const cps: number[] = [];
  for (let i = 0; i < value.length; ) {
    const cp = value.codePointAt(i) ?? 0;
    cps.push(cp);
    i += cp > 0xffff ? 2 : 1;
  }
  return cps;
}

function isForbiddenInvisibleOrControl(cp: number): boolean {
  // Hangul invisible fillers (U+115F, U+1160, U+3164, U+FFA0) & Braille blank (U+2800)
  if (cp === 0x115f || cp === 0x1160 || cp === 0x3164 || cp === 0xffa0 || cp === 0x2800) {
    return true;
  }
  // Zero-width & invisible formatting characters (ZWJ U+200D and variation selectors handled contextually)
  if (
    cp === 0x00ad ||
    cp === 0x034f ||
    cp === 0x061c ||
    cp === 0x17b4 ||
    cp === 0x17b5 ||
    cp === 0x180e ||
    cp === 0x200b ||
    cp === 0x200c ||
    cp === 0x200e ||
    cp === 0x200f ||
    (cp >= 0x2060 && cp <= 0x2064) ||
    (cp >= 0x206a && cp <= 0x206f) ||
    cp === 0xfeff ||
    (cp >= 0xfff9 && cp <= 0xfffc) ||
    cp === 0x1d159 ||
    (cp >= 0x1d173 && cp <= 0x1d17a) ||
    (cp >= 0xe0000 && cp <= 0xe001f)
  ) {
    return true;
  }
  // Bidi overrides, embeddings, and isolates
  if ((cp >= 0x202a && cp <= 0x202e) || (cp >= 0x2066 && cp <= 0x2069)) {
    return true;
  }
  // C0 controls (except \t, \n, \r), DEL, and C1 controls
  return (
    (cp >= 0x0000 && cp <= 0x0008) ||
    cp === 0x000b ||
    cp === 0x000c ||
    (cp >= 0x000e && cp <= 0x001f) ||
    (cp >= 0x007f && cp <= 0x009f)
  );
}

function isUnicodeSpace(cp: number): boolean {
  return (
    cp === 0x0009 ||
    cp === 0x0020 ||
    cp === 0x00a0 ||
    cp === 0x1680 ||
    (cp >= 0x2000 && cp <= 0x200a) ||
    cp === 0x202f ||
    cp === 0x205f ||
    cp === 0x3000
  );
}

function isVariationSelector(cp: number): boolean {
  return (cp >= 0xfe00 && cp <= 0xfe0f) || (cp >= 0xe0100 && cp <= 0xe01ef);
}

function isTagChar(cp: number): boolean {
  return cp >= 0xe0020 && cp <= 0xe007f;
}

function isCombiningMark(cp: number): boolean {
  if (cp < 0x0300) return false;
  if (COMBINING_MARK_RE) return COMBINING_MARK_RE.test(String.fromCodePoint(cp));
  return (
    (cp >= 0x0300 && cp <= 0x036f) ||
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x1dc0 && cp <= 0x1dff) ||
    (cp >= 0x20d0 && cp <= 0x20ff) ||
    (cp >= 0xfe20 && cp <= 0xfe2f)
  );
}

function isEmojiAnchor(cp: number): boolean {
  if (cp < 0x80) return false;
  if (cp >= 0x1f1e6 && cp <= 0x1f1ff) return true;
  if (cp >= 0x2600 && cp <= 0x27bf) return true;
  return EMOJI_BASE_RE.test(String.fromCodePoint(cp));
}

function previousNonCombining(emitted: number[]): number {
  for (let i = emitted.length - 1; i >= 0; i -= 1) {
    const cp = emitted[i];
    if (!isVariationSelector(cp) && !isCombiningMark(cp)) return cp;
  }
  return -1;
}

function previousEmojiAnchor(emitted: number[]): number {
  for (let i = emitted.length - 1; i >= 0; i -= 1) {
    const cp = emitted[i];
    if (isVariationSelector(cp) || isTagChar(cp) || cp === 0x20e3) continue;
    return isEmojiAnchor(cp) ? cp : -1;
  }
  return -1;
}

function nextEmojiAnchor(cps: number[], fromIdx: number): number {
  for (let i = fromIdx; i < cps.length; i += 1) {
    const cp = cps[i];
    if (cp === 0x200d || isVariationSelector(cp)) continue;
    return isEmojiAnchor(cp) ? cp : -1;
  }
  return -1;
}

function filterContextualSequences(stage1: number[]): number[] {
  const stage2: number[] = [];
  let inFlagTag = false;
  for (let idx = 0; idx < stage1.length; idx += 1) {
    const cp = stage1[idx];
    if (cp === 0x1f3f4) {
      inFlagTag = true;
      stage2.push(cp);
      continue;
    }
    if (isTagChar(cp)) {
      if (inFlagTag) {
        stage2.push(cp);
        if (cp === 0xe007f) inFlagTag = false;
      }
      continue;
    }
    inFlagTag = false;

    if (isVariationSelector(cp)) {
      const prevBase = previousNonCombining(stage2);
      if (prevBase >= 0 && prevBase !== 0x20 && prevBase !== 0x0a && prevBase !== 0x200d) {
        stage2.push(cp);
      }
      continue;
    }

    if (isCombiningMark(cp)) {
      const prevBase = previousNonCombining(stage2);
      if (prevBase >= 0 && prevBase !== 0x20 && prevBase !== 0x0a && prevBase !== 0x200d) {
        stage2.push(cp);
      }
      continue;
    }

    if (cp === 0x200d) {
      const prevAnchor = previousEmojiAnchor(stage2);
      const nextAnchor = nextEmojiAnchor(stage1, idx + 1);
      if (prevAnchor >= 0 && nextAnchor >= 0 && stage2.at(-1) !== 0x200d) {
        stage2.push(cp);
      }
      continue;
    }

    stage2.push(cp);
  }
  return stage2;
}

function fromCodePoints(cps: number[], start = 0, end = cps.length): string {
  let result = "";
  const chunk = 4096;
  for (let i = start; i < end; i += chunk) {
    result += String.fromCodePoint(...cps.slice(i, Math.min(i + chunk, end)));
  }
  return result;
}

/**
 * Removes forbidden invisible fillers (Hangul fillers, Braille blank, zero-width/bidi/control chars)
 * while keeping normal spaces, newlines, Hangul, and valid emoji ZWJ sequences intact during typing.
 */
export function stripInvisibleChars(value: string): string {
  if (!value) return "";
  const cps = toCodePoints(value);
  const stage1: number[] = [];
  for (const cp of cps) {
    if (isForbiddenInvisibleOrControl(cp)) continue;
    if (cp === 0x2028 || cp === 0x2029) {
      stage1.push(0x0a);
      continue;
    }
    stage1.push(cp);
  }
  const filtered = filterContextualSequences(stage1);
  return fromCodePoints(filtered);
}

function sanitizeCore(value: string, multiline: boolean): string {
  if (!value) return "";
  const cps = toCodePoints(value);
  const stage1: number[] = [];
  for (let i = 0; i < cps.length; i += 1) {
    const cp = cps[i];
    if (cp === 0x0d) {
      if (i + 1 < cps.length && cps[i + 1] === 0x0a) i += 1;
      stage1.push(multiline ? 0x0a : 0x20);
      continue;
    }
    if (cp === 0x0a || cp === 0x2028 || cp === 0x2029) {
      stage1.push(multiline ? 0x0a : 0x20);
      continue;
    }
    if (isForbiddenInvisibleOrControl(cp)) continue;
    if (isUnicodeSpace(cp)) {
      stage1.push(0x20);
      continue;
    }
    stage1.push(cp);
  }

  const stage2 = filterContextualSequences(stage1);
  let start = 0;
  while (start < stage2.length && (stage2[start] === 0x20 || stage2[start] === 0x0a)) {
    start += 1;
  }
  let end = stage2.length;
  while (end > start && (stage2[end - 1] === 0x20 || stage2[end - 1] === 0x0a)) {
    end -= 1;
  }
  if (start >= end) return "";
  const sanitized = fromCodePoints(stage2, start, end);
  return hasVisibleText(sanitized) ? sanitized : "";
}

/** Strips invisible/control chars, normalizes Unicode spaces and newlines into spaces, and trims edges. */
export function sanitizeSingleLine(value: string): string {
  return sanitizeCore(value, false);
}

/** Strips invisible/control chars, normalizes Unicode spaces & line breaks while preserving internal newlines. */
export function sanitizeMultiline(value: string): string {
  return sanitizeCore(value, true);
}

/** Returns true when at least one visible non-whitespace, non-combining code point remains. */
export function hasVisibleText(value: string): boolean {
  if (!value) return false;
  for (const cp of toCodePoints(value)) {
    if (
      cp !== 0x20 &&
      cp !== 0x0a &&
      cp !== 0x0d &&
      cp !== 0x2028 &&
      cp !== 0x2029 &&
      cp !== 0x200d &&
      !isVariationSelector(cp) &&
      !isTagChar(cp) &&
      !isForbiddenInvisibleOrControl(cp) &&
      !isUnicodeSpace(cp) &&
      !isCombiningMark(cp)
    ) {
      return true;
    }
  }
  return false;
}

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

/** Strips forbidden invisible chars and clamps a string to at most `max` Unicode code points without splitting surrogate pairs. */
export function clampCodePoints(value: string, max: number): string {
  if (max <= 0) return "";
  const clean = stripInvisibleChars(value);
  let count = 0;
  let end = 0;
  while (end < clean.length && count < max) {
    const code = clean.codePointAt(end) ?? 0;
    end += code > 0xffff ? 2 : 1;
    count += 1;
  }
  return clean.slice(0, end);
}
