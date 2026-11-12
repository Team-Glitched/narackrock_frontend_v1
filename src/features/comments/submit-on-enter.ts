type EnterKeyEvent = {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  keyCode: number;
};

/**
 * On a physical keyboard Enter sends a comment and Shift+Enter inserts a line break.
 * Touch keyboards have no Shift+Enter, so there Enter keeps inserting a line break and the send button sends.
 * The Enter that confirms a Korean IME syllable must not send the unfinished text.
 */
export function shouldSubmitOnEnter(event: EnterKeyEvent, touchKeyboard = false): boolean {
  if (touchKeyboard || event.key !== "Enter" || event.shiftKey) return false;
  return !event.isComposing && event.keyCode !== 229;
}

/** Phones and tablets: no hover and a coarse pointer. */
export function usesTouchKeyboard(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(hover: none) and (pointer: coarse)").matches
  );
}
