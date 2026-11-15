import { useEffect } from "react";
import { useLocation } from "react-router";
import { useWebModalOpen } from "@/hooks/use-web-modal-open";
import { nativeApp, requestNative } from "@/lib/native-app";

/** Tells the app whether a web modal is open and whether its back button has a page to return to. No-op in browsers. */
export function useNativeReports() {
  const inApp = nativeApp() !== null;
  const open = useWebModalOpen();
  const { key } = useLocation();
  useEffect(() => {
    if (inApp) void requestNative("set-modal", { open });
  }, [inApp, open]);
  useEffect(() => {
    // react-router keeps the entry's position in history.state; 0 is where this app session started.
    if (inApp) void requestNative("set-history", { canGoBack: (window.history.state?.idx ?? 0) > 0 });
  }, [inApp, key]);
}
