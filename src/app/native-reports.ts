import { useEffect, useSyncExternalStore } from "react";
import { useLocation } from "react-router";
import { nativeApp, requestNative } from "@/lib/native-app";

// Web modals (all marked aria-modal, mounted only while open) must stay reachable in the app, but
// native views (tab bar, native screens) sit above the whole WebView, so the app hides them meanwhile.
function subscribeModals(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true, attributeFilter: ["aria-modal"] });
  return () => observer.disconnect();
}
const modalOpen = () => document.querySelector('[aria-modal="true"]') !== null;
const noModals = () => () => {};
const neverOpen = () => false;

/** Tells the app whether a web modal is open and whether its back button has a page to return to. No-op in browsers. */
export function useNativeReports() {
  const inApp = nativeApp() !== null;
  const open = useSyncExternalStore(inApp ? subscribeModals : noModals, inApp ? modalOpen : neverOpen);
  const { key } = useLocation();
  useEffect(() => {
    if (inApp) void requestNative("set-modal", { open });
  }, [inApp, open]);
  useEffect(() => {
    // react-router keeps the entry's position in history.state; 0 is where this app session started.
    if (inApp) void requestNative("set-history", { canGoBack: (window.history.state?.idx ?? 0) > 0 });
  }, [inApp, key]);
}
