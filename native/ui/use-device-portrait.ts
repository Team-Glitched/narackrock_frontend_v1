import { useSyncExternalStore } from "react";
import { Dimensions } from "react-native";

function subscribe(listener: () => void) {
  const subscription = Dimensions.addEventListener("change", listener);
  return () => subscription.remove();
}

function portrait() {
  // Android may resize the window for the keyboard; the screen keeps its physical orientation.
  const { width, height } = Dimensions.get("screen");
  return height >= width;
}

export function useDevicePortrait() {
  return useSyncExternalStore(subscribe, portrait, () => true);
}
