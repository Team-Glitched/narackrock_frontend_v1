import type { ScreenRegistry } from "../types";
import { AdminCommunityScreen } from "./community";
import { AdminReviewScreen } from "./review";

/** Native screens of the admin feature; spread into ../index.tsx. */
export const adminScreens: ScreenRegistry<"admin"> = {
  "admin-review": AdminReviewScreen,
  "admin-community": AdminCommunityScreen,
};
