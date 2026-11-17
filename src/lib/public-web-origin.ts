const configuredOrigin = (import.meta.env?.VITE_PUBLIC_WEB_ORIGIN ?? "").trim().replace(/\/$/, "");

/**
 * Origin for links that leave the app (share links). The web build uses the page origin;
 * the native app serves the build from 127.0.0.1, so it sets `VITE_PUBLIC_WEB_ORIGIN`.
 */
export function publicWebOrigin(): string {
  return configuredOrigin || window.location.origin;
}
