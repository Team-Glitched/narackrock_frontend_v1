import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
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
  createLabel,
}: {
  activeTab: Exclude<FooterTab, "studio"> | null;
  onCreate: () => void;
  createLabel: string;
}) {
  const { to } = useUrlNavigation();
  return (
    <footer className={sharedStyles.appFooter}>
      {nav.map((item) => (
        <button
          key={item.id}
          className={cn(
            item.id === "studio" ? sharedStyles.makeButton : "",
            item.id === activeTab ? sharedStyles.active : "",
          )}
          onClick={() => item.id === "studio" ? onCreate() : to(item.path)}
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
