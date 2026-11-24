export type ManualOrientation = "portrait" | "landscape" | null;
export type NativeLockMode = "portrait" | "landscape" | "default";
export type NativeOrientationState = {
  allowsLandscape: boolean;
  manualOrientation: ManualOrientation;
};

export const initialNativeOrientation: NativeOrientationState = {
  allowsLandscape: false,
  manualOrientation: null,
};

/**
 * Updates canvas capability and manual override from the reported native screen kind.
 * `isCanvas === null` means no screen currently holds a view (transient handoff between
 * unmounting and mounting views), so the existing lock and manual choice stay intact until
 * a non-canvas screen is confirmed.
 */
export function reduceNativeOrientation(
  state: NativeOrientationState,
  isCanvas: boolean | null,
): NativeOrientationState {
  if (isCanvas === null) return state;
  const manualOrientation = isCanvas ? state.manualOrientation : null;
  if (state.allowsLandscape === isCanvas && state.manualOrientation === manualOrientation) {
    return state;
  }
  return { allowsLandscape: isCanvas, manualOrientation };
}

/** Resolves the target native orientation lock, temporarily permitting portrait when requested. */
export function resolveNativeLockMode(
  state: NativeOrientationState,
  portraitRequiredCount = 0,
): NativeLockMode {
  const base: NativeLockMode = !state.allowsLandscape
    ? "portrait"
    : state.manualOrientation === "landscape"
      ? "landscape"
      : state.manualOrientation === "portrait"
        ? "portrait"
        : "default";
  if (portraitRequiredCount > 0 && base === "landscape") return "default";
  return base;
}

/**
 * Temporarily relaxes a landscape lock before presenting a portrait-only native UI (such as
 * iOS's editing UIImagePickerController) and restores the active canvas lock afterward without
 * discarding the user's manual selection.
 */
export async function runWithPortraitAllowed<T>({
  getState,
  countRef,
  onCountChange,
  applyLock,
  task,
}: {
  getState: () => NativeOrientationState;
  countRef: { current: number };
  onCountChange?: (count: number) => void;
  applyLock: (mode: NativeLockMode) => Promise<void>;
  task: () => Promise<T>;
}): Promise<T> {
  const before = resolveNativeLockMode(getState(), countRef.current);
  countRef.current += 1;
  onCountChange?.(countRef.current);
  try {
    const during = resolveNativeLockMode(getState(), countRef.current);
    if (during !== before) await applyLock(during).catch(() => {});
    return await task();
  } finally {
    countRef.current = Math.max(0, countRef.current - 1);
    onCountChange?.(countRef.current);
    const after = resolveNativeLockMode(getState(), countRef.current);
    await applyLock(after).catch(() => {});
  }
}
