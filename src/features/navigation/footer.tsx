import { useEffect, useEffectEvent } from "react";
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

  // The app draws the footer natively (native/tab-bar.tsx) over an empty placeholder that keeps the
  // canvas layout, and sends its presses back here so each page keeps its own create action.
  const inApp = nativeApp() !== null;
  const press = useEffectEvent((pressed: NativeFooterPress) => {
    const tab = nav.find((item) => item.id === pressed);
    if (pressed === "create") create();
    else if (tab) to(tab.path);
  });
  useEffect(() => onFooterPress((pressed) => press(pressed)), []);
  useEffect(() => {
    if (inApp) void requestNative("set-footer", { footer: { activeTab, createLabel } });
  }, [inApp, activeTab, createLabel]);
  useEffect(() => {
    if (inApp) return () => void requestNative("set-footer", { footer: null });
  }, [inApp]);
  if (inApp) return <footer className={sharedStyles.appFooter} aria-hidden="true" />;

  return (
    <footer className={sharedStyles.appFooter}>
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
