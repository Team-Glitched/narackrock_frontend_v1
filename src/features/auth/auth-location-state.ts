import type { NavigationState } from "@/features/navigation/use-url-navigation";
import type { PendingProfileSetup } from "./profile-setup";
export type AuthLocationState = NavigationState & {
  returnTo?: string;
  pending?: PendingProfileSetup;
};
