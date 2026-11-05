import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { useUrlNavigation } from "./use-url-navigation";
import { Asset } from "@/components/asset";
import { IconSlot } from "@/components/icon-slot";
// The five footer tabs. `studio` is the center action button, not a real tab.
type FooterTab = "home" | "abyss" | "studio" | "social" | "opensource";
const nav: { id: FooterTab; label: string; path: string }[] = [
  { id: "home", label: "홈", path: "/" },
  { id: "abyss", label: "어비스", path: "/abyss" },
  { id: "studio", label: "", path: "" },
  { id: "social", label: "소셜", path: "/social" },
  { id: "opensource", label: "오픈소스", path: "/sources" },
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
            <IconSlot name={`nav-${item.id}-${item.id === activeTab ? "on" : "off"}.svg`} kind="nav" />
          )}
          {item.label && <span>{item.label}</span>}
        </button>
      ))}
    </footer>
  );
}
