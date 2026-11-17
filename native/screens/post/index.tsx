import type { ScreenRegistry } from "../types";
import { PostCreateScreen } from "./post-create";
import { PostDetailScreen } from "./post-detail";

/** Native screens of the post feature; spread into ../index.tsx. */
export const postScreens: ScreenRegistry<"post"> = {
  "post-detail": PostDetailScreen,
  "post-create": PostCreateScreen,
};
