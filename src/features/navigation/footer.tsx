import { useEffect, useEffectEvent, useSyncExternalStore } from "react";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { nativeApp, onFooterPress, requestNative } from "@/lib/native-app";
import type { NativeFooterPress } from "@/lib/native-bridge-protocol";
import { useUrlNavigation } from "./use-url-navigation";
import { Asset } from "@/components/asset";
import { iconSlotVariants } from "@/styles/variants";
// The five footer tabs. `studio` is the center action button, not a real tab.
type FooterTab = "home" | "abyss" | "studio" | "social" | "opensource";
const nav: { id: FooterTab; label: string; path: string }[] = [
  { id: "home", label: "홈", path: "/" },
  { id: "abyss", label: "어비스", path: "/abyss" },
  { id: "studio", label: "", path: "" },
  { id: "social", label: "소셜", path: "/social" },
  { id: "opensource", label: "샘플", path: "/sources" },
];

// Web modals (all marked aria-modal, mounted only while open) cover the footer. The app's native
// bar sits above the whole WebView, so it has to step aside for them.
function subscribeModals(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, { childList: true, subtree: true, attributeFilter: ["aria-modal"] });
  return () => observer.disconnect();
}
const modalOpen = () => document.querySelector('[aria-modal="true"]') !== null;
const noModals = () => () => {};
const neverOpen = () => false;

export function Footer({
  activeTab,
  onCreate,
  createLabel = "곡 만들기",
}: {
  activeTab: Exclude<FooterTab, "studio"> | null;
  onCreate?: () => void;
  createLabel?: string;
}) {
  const { to, currentPath } = useUrlNavigation();
  const create = onCreate ?? (() => {
    to("/studio/new", { state: { studioFrom: currentPath, studioIndex: window.history.state?.idx } });
  });

  // The app draws the footer natively (native/tab-bar.tsx) over this one, which stays rendered but
  // inert: it keeps the canvas layout and shows, dimmed by the backdrop, while a modal hides the
  // native bar. Native presses come back here so each page keeps its own create action.
  const inApp = nativeApp() !== null;
  const covered = useSyncExternalStore(inApp ? subscribeModals : noModals, inApp ? modalOpen : neverOpen);
  const press = useEffectEvent((pressed: NativeFooterPress) => {
    const tab = nav.find((item) => item.id === pressed);
    if (pressed === "create") create();
    else if (tab) to(tab.path);
  });
  useEffect(() => onFooterPress((pressed) => press(pressed)), []);
  useEffect(() => {
    if (inApp)
      void requestNative("set-footer", { footer: covered ? null : { activeTab, createLabel } });
  }, [inApp, covered, activeTab, createLabel]);
  useEffect(() => {
    if (inApp) return () => void requestNative("set-footer", { footer: null });
  }, [inApp]);

  return (
    <footer className={sharedStyles.appFooter} inert={inApp}>
      {nav.map((item) => (
        <button
          key={item.id}
          className={cn(
            item.id === "studio" ? sharedStyles.makeButton : "",
            item.id === activeTab ? sharedStyles.active : "",
          )}
          onClick={() => item.id === "studio" ? create() : to(item.path)}
          aria-label={item.id === "studio" ? createLabel : item.label}
          aria-current={item.id === activeTab ? "page" : undefined}
        >
          {item.id === "studio" ? (
            <>
              <Asset name="make-circle.svg" />
              <i />
            </>
          ) : (
            // Both variants stay mounted so switching tabs never waits for the other SVG to download: an unloaded
            // image renders as nothing, which blanked each icon the first time its tab was entered or left.
            <span className={iconSlotVariants({ kind: "nav" })} aria-hidden="true">
              {(["on", "off"] as const).map((state) => (
                <Asset
                  key={state}
                  name={`nav-${item.id}-${state}.svg`}
                  className={(state === "on") === (item.id === activeTab) ? "" : "invisible"}
                />
              ))}
            </span>
          )}
          {item.label && <span>{item.label}</span>}
        </button>
      ))}
    </footer>
  );
}
