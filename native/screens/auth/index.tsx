import type { ScreenRegistry } from "../types";
import { LoginScreen } from "./login";
import { OnboardingScreen } from "./onboarding";

/** Native screens of the auth feature; spread into ../index.tsx. */
export const authScreens: ScreenRegistry<"auth"> = {
  "auth-login": LoginScreen,
  "auth-onboarding": OnboardingScreen,
};
