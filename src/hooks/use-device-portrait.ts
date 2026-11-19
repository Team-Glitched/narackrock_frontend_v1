import { useSyncExternalStore } from "react";
import { devicePortrait, subscribeDeviceOrientation } from "@/lib/device-orientation";

export function useDevicePortrait() {
  return useSyncExternalStore(subscribeDeviceOrientation, devicePortrait, () => true);
}
