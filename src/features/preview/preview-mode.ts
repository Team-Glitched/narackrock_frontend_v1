/** The isolated preview never uses or changes the production authentication session. */
export function isPreviewMode() {
  return typeof window !== "undefined" && window.location.pathname.replace(/\/$/, "") === "/preview";
}
