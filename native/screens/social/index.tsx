import type { ScreenRegistry } from "../types";
import {
  CommunityDetailScreen,
  FriendsListScreen,
  JoinedScreen,
  PageStateScreen,
} from "./community";
import { CreateCommunityScreen } from "./create-community";
import { SocialScreen } from "./social";

/** Native screens of the social feature; spread into ../index.tsx. */
export const socialScreens: ScreenRegistry<"social"> = {
  social: SocialScreen,
  "social-friends-list": FriendsListScreen,
  "social-community": CommunityDetailScreen,
  "social-page-state": PageStateScreen,
  "social-joined": JoinedScreen,
  "social-create-community": CreateCommunityScreen,
};
