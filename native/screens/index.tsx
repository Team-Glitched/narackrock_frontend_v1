import type { ComponentType } from "react";

import type { NativeScreenKind } from "../../src/lib/native-screens";
import { HomeScreen } from "./home";
import type { ScreenProps } from "./types";

/** Native screen components by kind; the web side is src/lib/native-screens/index.ts. */
export const screens: { [K in NativeScreenKind]: ComponentType<ScreenProps<K>> } = {
  home: HomeScreen,
};
