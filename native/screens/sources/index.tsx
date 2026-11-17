import type { ScreenRegistry } from "../types";
import { SourcesScreen } from "./sources";
import { SourceDetailScreen } from "./detail";
import { SourceCreateScreen } from "./create";

/** Native screens of the sources feature; spread into ../index.tsx. */
export const sourcesScreens: ScreenRegistry<"sources"> = {
  sources: SourcesScreen,
  "source-detail": SourceDetailScreen,
  "source-create": SourceCreateScreen,
};
