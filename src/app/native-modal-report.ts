import { useEffect, useSyncExternalStore } from "react";
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

/** Tells the app whether a web modal is open. No-op in browsers. */
export function useNativeModalReport() {
  const inApp = nativeApp() !== null;
  const open = useSyncExternalStore(inApp ? subscribeModals : noModals, inApp ? modalOpen : neverOpen);
  useEffect(() => {
    if (inApp) void requestNative("set-modal", { open });
  }, [inApp, open]);
}
