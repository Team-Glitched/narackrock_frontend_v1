import type { ComponentType } from "react";

import type { NativeScreenKind } from "../../src/lib/native-screens";
import { ChartsScreen } from "./charts";
import { HomeScreen } from "./home";
import { PostsScreen } from "./posts";
import { SearchScreen } from "./search";
import type { ScreenProps } from "./types";

/** Native screen components by kind; the web side is src/lib/native-screens/index.ts. */
export const screens: { [K in NativeScreenKind]: ComponentType<ScreenProps<K>> } = {
  home: HomeScreen,
  charts: ChartsScreen,
  posts: PostsScreen,
  search: SearchScreen,
};
