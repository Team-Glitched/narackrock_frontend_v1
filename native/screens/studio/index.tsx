import type { ScreenRegistry } from "../types";
import { StudioLayerChoiceScreen, StudioNewScreen } from "./pages";
import { StudioTimelineScreen } from "./timeline";

/** Native screens of the studio feature; spread into ../index.tsx. */
export const studioScreens: ScreenRegistry<"studio"> = {
  "studio-timeline": StudioTimelineScreen,
  "studio-new": StudioNewScreen,
  "studio-layer-choice": StudioLayerChoiceScreen,
};
