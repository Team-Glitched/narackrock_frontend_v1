import { useSyncExternalStore } from "react";
import { nativeApp } from "@/lib/native-app";

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

/** Whether a web modal is open; tracked only in the app (always false in browsers). */
export function useWebModalOpen(): boolean {
  const inApp = nativeApp() !== null;
  return useSyncExternalStore(inApp ? subscribeModals : noModals, inApp ? modalOpen : neverOpen);
}
