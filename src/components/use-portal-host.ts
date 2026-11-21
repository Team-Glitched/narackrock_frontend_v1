import { useLayoutEffect, useState, type RefObject } from "react";

export function usePortalHost(
  selector: ".phone-frame" | ".design-canvas",
  anchorRef?: RefObject<HTMLElement | null>,
): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    // Keep popups inside their modal's accessible subtree and resolve the committed frame before paint.
    setHost(
      anchorRef?.current?.closest<HTMLElement>(".figma-sheet-overlay, .notifications-screen") ??
        document.querySelector<HTMLElement>(selector),
    );
  }, [selector, anchorRef]);
  return host;
}
