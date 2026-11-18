import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { useLayoutEffect, useRef, type ReactNode } from "react";
import { nativeApp } from "@/lib/native-app";

export function DesignViewport(props: { landscape?: boolean; children: ReactNode }) {
  return nativeApp() ? props.children : <WebDesignViewport {...props} />;
}

/** The Figma canvases are 390×844 and 844×390. Scale the whole canvas,
 * never independently shrink its icons, text, or available content height. */
function WebDesignViewport({
  landscape = false,
  children,
}: {
  landscape?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    // A layout change must not reuse the keyboard height/scale of the previous orientation.
    host.style.height = "";
    const width = landscape ? 844 : 390;
    const height = landscape ? 390 : 844;
    let fullWidth = host.clientWidth;
    let fullHeight = host.clientHeight;
    let normalScale = Math.min(fullWidth / width, fullHeight / height, 1);
    const viewport = window.visualViewport;
    const fit = () => {
      if (host.clientWidth !== fullWidth) {
        host.style.height = "";
        fullWidth = host.clientWidth;
        fullHeight = host.clientHeight;
        normalScale = Math.min(fullWidth / width, fullHeight / height, 1);
      }
      const editable =
        document.activeElement instanceof HTMLElement &&
        document.activeElement.matches(
          "input:not([type=range]):not([type=file]),textarea,[contenteditable=true]",
        );
      const keyboardVisible =
        window.matchMedia("(pointer: coarse)").matches &&
        editable &&
        Boolean(viewport && viewport.height < fullHeight * 0.8);
      host.dataset.keyboardVisible = String(keyboardVisible);
      if (keyboardVisible && viewport) {
        host.style.setProperty("--canvas-scale", String(normalScale));
        host.style.height = `${viewport.height}px`;
        host.style.setProperty(
          "--visible-canvas-height",
          `${Math.min(landscape ? 390 : 844, viewport.height / normalScale)}px`,
        );
        return;
      }
      host.style.height = "";
      fullHeight = host.clientHeight;
      const scale = Math.min(
        host.clientWidth / width,
        host.clientHeight / height,
        1,
      );
      normalScale = scale;
      host.style.setProperty("--canvas-scale", String(scale));
    };
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    let frame = 0;
    const focusChanged = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(fit);
    };
    viewport?.addEventListener("resize", fit);
    viewport?.addEventListener("scroll", fit);
    document.addEventListener("focusin", focusChanged);
    document.addEventListener("focusout", focusChanged);
    fit();
    return () => {
      observer.disconnect();
      viewport?.removeEventListener("resize", fit);
      viewport?.removeEventListener("scroll", fit);
      document.removeEventListener("focusin", focusChanged);
      document.removeEventListener("focusout", focusChanged);
      cancelAnimationFrame(frame);
    };
  }, [landscape]);
  return (
    <main
      ref={ref}
      className={cn(
        sharedStyles.designViewport,
        landscape ? sharedStyles.designViewportLandscape : "",
      )}
    >
      <div className={sharedStyles.designCanvas}>{children}</div>
    </main>
  );
}
