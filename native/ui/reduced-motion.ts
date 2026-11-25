import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/**
 * The system's reduce-motion setting (the web's `prefers-reduced-motion: reduce`), kept current.
 * null until the setting is known, so callers that must not start animating early can wait.
 */
export function useReducedMotion(): boolean | null {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    let active = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (active) setReduced(value);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
