import { useLayoutEffect, useState, type RefObject } from "react";

export function usePortalHost(
  selector: ".phone-frame" | ".design-canvas",
  anchorRef?: RefObject<HTMLElement | null>,
): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    // Portals must resolve the committed page frame before paint, not cache a previous route's host.
    setHost(
      anchorRef?.current?.closest<HTMLElement>(".figma-sheet-overlay") ??
        document.querySelector<HTMLElement>(selector),
    );
  }, [selector, anchorRef]);
  return host;
}
