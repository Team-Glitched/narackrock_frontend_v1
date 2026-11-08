import { safeReturnPath } from "../navigation/paths.ts";

/** Public browsing stays available; personal data and server writes require a session. */
export function requiresLogin(path: string): boolean {
  const url = new URL(safeReturnPath(path), "https://narackrock.local");
  const pathname = url.pathname.replace(/\/+$/, "") || "/";
  if (
    /^\/(profile|settings|saved|workspace|submissions|reviews|library|friends|chat|notifications|admin|studio|sources)(\/|$)/.test(
      pathname,
    )
  )
    return true;
  if (/^\/posts\/(new|\d+)$/.test(pathname)) return true;
  if (/^\/communities\/(new|joined|manage|\d+\/(manage|members|posts\/\d+))$/.test(pathname))
    return true;
  if (pathname === "/charts" && url.searchParams.get("kind") === "mine") return true;
  if (pathname === "/search" && ["people", "sources"].includes(url.searchParams.get("scope") ?? ""))
    return true;
  return url.searchParams.get("notifications") === "1";
}

export function loginDestination(returnTo: string, from: string) {
  return { returnTo: safeReturnPath(returnTo), from: safeReturnPath(from) };
}
