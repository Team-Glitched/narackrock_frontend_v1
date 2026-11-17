import { useEffect, useRef } from "react";
import { BackHandler } from "react-native";

import { useScreen } from "./screen-context";

/**
 * Lets an in-screen dialog or sheet take hardware Back (the last listener runs first). Only while its
 * screen is on display: a cached screen keeps its last view mounted, and a dialog left open there
 * must not swallow Back for the screen the user is on.
 */
export function useScreenBack(onBack: () => void) {
  const { active } = useScreen();
  const handler = useRef(onBack);
  handler.current = onBack;
  useEffect(() => {
    if (!active) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      handler.current();
      return true;
    });
    return () => subscription.remove();
  }, [active]);
}
