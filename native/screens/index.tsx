import type { ComponentType } from "react";

import type { NativeScreenKind } from "../../src/lib/native-screens";
import { abyssScreens } from "./abyss";
import { adminScreens } from "./admin";
import { authScreens } from "./auth";
import { ChartsScreen } from "./charts";
import { chatScreens } from "./chat";
import { HomeScreen } from "./home";
import { postScreens } from "./post";
import { PostsScreen } from "./posts";
import { profileScreens } from "./profile";
import { SearchScreen } from "./search";
import { socialScreens } from "./social";
import { sourcesScreens } from "./sources";
import type { ScreenProps, ScreenRegistry } from "./types";
import { workspaceScreens } from "./workspace";

const listScreens: ScreenRegistry<"lists"> = {
  home: HomeScreen,
  charts: ChartsScreen,
  posts: PostsScreen,
  search: SearchScreen,
};

/** Native screen components by kind; the web side is src/lib/native-screens/index.ts. */
export const screens: { [K in NativeScreenKind]: ComponentType<ScreenProps<K>> } = {
  ...listScreens,
  ...postScreens,
  ...socialScreens,
  ...sourcesScreens,
  ...profileScreens,
  ...authScreens,
  ...workspaceScreens,
  ...abyssScreens,
  ...chatScreens,
  ...adminScreens,
};
