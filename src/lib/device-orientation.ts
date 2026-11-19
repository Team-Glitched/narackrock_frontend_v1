/** Read the screen, not the keyboard-resized viewport. Desktop pages default to portrait. */
export function devicePortrait(target: Window = window): boolean {
  if (!target.matchMedia("(pointer: coarse)").matches) return true;
  const type = target.screen.orientation?.type;
  if (type?.startsWith("portrait")) return true;
  if (type?.startsWith("landscape")) return false;
  // Older iOS Safari exposes window.orientation instead of ScreenOrientation.
  const angle = (target as Window & { orientation?: number }).orientation;
  if (typeof angle === "number") return Math.abs(angle) !== 90;
  const { width, height } = target.screen;
  return width > 0 && height > 0 ? height >= width : true;
}

export function subscribeDeviceOrientation(listener: () => void, target: Window = window) {
  const screenOrientation = target.screen.orientation;
  const pointer = target.matchMedia("(pointer: coarse)");
  screenOrientation?.addEventListener("change", listener);
  target.addEventListener("orientationchange", listener);
  target.addEventListener("resize", listener);
  pointer.addEventListener("change", listener);
  return () => {
    screenOrientation?.removeEventListener("change", listener);
    target.removeEventListener("orientationchange", listener);
    target.removeEventListener("resize", listener);
    pointer.removeEventListener("change", listener);
  };
}
