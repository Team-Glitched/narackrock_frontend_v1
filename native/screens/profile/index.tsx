import type { ScreenRegistry } from "../types";
import { EditProfileScreen } from "./edit-profile";
import { LikedPostsScreen } from "./liked-posts";
import { NotificationsScreen } from "./notifications";
import { PrivacyScreen } from "./privacy";
import { ProfileScreen } from "./profile";
import { SavedScreen } from "./saved";
import { SettingsScreen } from "./settings";

/** Native screens of the profile feature; spread into ../index.tsx. */
export const profileScreens: ScreenRegistry<"profile"> = {
  "profile-view": ProfileScreen,
  "profile-edit": EditProfileScreen,
  "profile-likes": LikedPostsScreen,
  "profile-settings": SettingsScreen,
  "profile-privacy": PrivacyScreen,
  "profile-saved": SavedScreen,
  "profile-notifications": NotificationsScreen,
};
