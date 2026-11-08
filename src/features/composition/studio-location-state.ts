import type { NavigationState } from "@/features/navigation/use-url-navigation";
export type StudioLocationState = NavigationState & {
  studioFrom?: string;
  studioIndex?: number;
  inbox?: boolean;
  contributionId?: number;
};
