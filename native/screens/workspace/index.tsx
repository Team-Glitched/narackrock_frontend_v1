import type { ScreenRegistry } from "../types";
import { WorkspaceLibraryScreen } from "./library";
import {
  WorkspaceReviewsScreen,
  WorkspaceSubmissionScreen,
  WorkspaceSubmissionsScreen,
} from "./requests";
import { WorkspaceWorksScreen } from "./works";

/** Native screens of the workspace feature; spread into ../index.tsx. */
export const workspaceScreens: ScreenRegistry<"workspace"> = {
  "workspace-works": WorkspaceWorksScreen,
  "workspace-submissions": WorkspaceSubmissionsScreen,
  "workspace-submission": WorkspaceSubmissionScreen,
  "workspace-reviews": WorkspaceReviewsScreen,
  "workspace-library": WorkspaceLibraryScreen,
};
