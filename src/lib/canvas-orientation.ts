import { devicePortrait, subscribeDeviceOrientation } from "./device-orientation.ts";

type OrientationOverride = "portrait" | "landscape" | null;

let manualOrientation: OrientationOverride = null;
let activeCanvases = 0;
let physicalUnsubscribe: (() => void) | null = null;
let lastPhysicalPortrait: boolean | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of [...listeners]) listener();
}

function defaultTarget(target?: Window): Window | undefined {
  return target ?? (typeof window === "undefined" ? undefined : window);
}

/** Whether composition canvases should currently render in portrait layout. */
export function canvasPortrait(target?: Window): boolean {
  if (manualOrientation !== null) return manualOrientation === "portrait";
  const win = defaultTarget(target);
  return win ? devicePortrait(win) : true;
}

/** Flips the active canvas orientation override and notifies listeners. */
export function toggleCanvasOrientation(target?: Window): boolean {
  const win = defaultTarget(target);
  const nextPortrait = !canvasPortrait(win);
  manualOrientation = nextPortrait ? "portrait" : "landscape";
  lastPhysicalPortrait = win ? devicePortrait(win) : null;
  emit();
  return nextPortrait;
}

/** Clears the manual override so canvases return to physical orientation. */
export function resetCanvasOrientation(): void {
  if (manualOrientation === null) return;
  manualOrientation = null;
  emit();
}

/** Subscribes to manual toggles and physical device rotations (ignoring resize/keyboard noise). */
export function subscribeCanvasOrientation(listener: () => void, target?: Window): () => void {
  const win = defaultTarget(target);
  listeners.add(listener);
  if (listeners.size === 1 && win) {
    lastPhysicalPortrait = devicePortrait(win);
    physicalUnsubscribe = subscribeDeviceOrientation(() => {
      const physical = devicePortrait(win);
      if (lastPhysicalPortrait !== null && physical !== lastPhysicalPortrait) {
        manualOrientation = null;
      }
      lastPhysicalPortrait = physical;
      emit();
    }, win);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      physicalUnsubscribe?.();
      physicalUnsubscribe = null;
      lastPhysicalPortrait = null;
    }
  };
}

/** Keeps manual orientation across canvas-to-canvas transitions and resets once no canvas remains mounted. */
export function retainCanvasOrientation(): () => void {
  activeCanvases += 1;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeCanvases = Math.max(0, activeCanvases - 1);
    queueMicrotask(() => {
      if (activeCanvases === 0) resetCanvasOrientation();
    });
  };
}
