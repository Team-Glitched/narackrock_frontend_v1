export type PlaybackMode = "repeat" | "next";

const storageKey = "glitched-shorts-playback-mode";

export function readPlaybackMode(storage: Pick<Storage, "getItem">): PlaybackMode {
  try {
    return storage.getItem(storageKey) === "next" ? "next" : "repeat";
  } catch {
    return "repeat";
  }
}

export function writePlaybackMode(storage: Pick<Storage, "setItem">, mode: PlaybackMode): void {
  try {
    storage.setItem(storageKey, mode);
  } catch {
    // Playback still works if the browser blocks persistent storage.
  }
}
