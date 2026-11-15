import type { NativeHeader, NativeScreenKind, NativeScreens } from "../../src/lib/native-screens";

/** What every native screen component receives; actions, session and images come from useScreen(). */
export type ScreenProps<K extends NativeScreenKind> = {
  model: NativeScreens[K]["model"];
  header: NativeHeader | null;
};
