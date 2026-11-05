import { useLayoutEffect, useState } from "react";

export function usePortalHost(selector: ".phone-frame" | ".design-canvas"): HTMLElement | null {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    // Portals must resolve the committed page frame before paint, not cache a previous route's host.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHost(document.querySelector<HTMLElement>(selector));
  }, [selector]);
  return host;
}
