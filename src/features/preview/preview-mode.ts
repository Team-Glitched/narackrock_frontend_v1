import { isPreviewPath } from "../navigation/paths.ts";

/** Preview URLs never use or change the production authentication session. */
export function isPreviewMode() {
  return typeof window !== "undefined" && isPreviewPath(window.location.pathname);
}
