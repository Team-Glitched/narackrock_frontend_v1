import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  canvasPortrait,
  retainCanvasOrientation,
  subscribeCanvasOrientation,
  toggleCanvasOrientation,
} from "@/lib/canvas-orientation";

/** Portrait/landscape state for composition canvas screens, combining device orientation with the manual toggle. */
export function useCanvasOrientation(active = true) {
  const portrait = useSyncExternalStore(subscribeCanvasOrientation, canvasPortrait, () => true);
  useEffect(() => {
    if (!active) return;
    return retainCanvasOrientation();
  }, [active]);
  const toggle = useCallback(() => {
    toggleCanvasOrientation();
  }, []);
  return { portrait, toggle };
}
