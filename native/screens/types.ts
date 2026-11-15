import type { ComponentType } from "react";

import type {
  NativeFeature,
  NativeFeatureScreens,
  NativeHeader,
  NativeScreenKind,
  NativeScreens,
} from "../../src/lib/native-screens";

/** What every native screen component receives; actions, session and images come from useScreen(). */
export type ScreenProps<K extends NativeScreenKind> = {
  model: NativeScreens[K]["model"];
  header: NativeHeader | null;
};

/** A feature's native screen components by kind (see native/screens/index.tsx). */
export type ScreenRegistry<F extends NativeFeature> = {
  [K in keyof NativeFeatureScreens[F] & NativeScreenKind]: ComponentType<ScreenProps<K>>;
};
