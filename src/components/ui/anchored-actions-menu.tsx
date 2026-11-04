import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { usePortalHost } from "./use-portal-host";

/** Figma Menu / Post User Actions, 15236:41267. */
export function AnchoredActionsMenu({
  anchorRef,
  className,
  onClose,
  label,
  height = 99,
  children,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  className: string;
  onClose: () => void;
  label: string;
  height?: number;
  children: ReactNode;
}) {
  const host = usePortalHost(".design-canvas");
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useEffect(() => {
    const anchor = anchorRef.current;
    if (!host || !anchor) return;
    const place = () => {
      const h = host.getBoundingClientRect(),
        a = anchor.getBoundingClientRect();
      const scale = h.width / host.offsetWidth;
      const left = Math.max(8, Math.min((a.right - h.left) / scale - 260, host.offsetWidth - 268));
      const below = (a.bottom - h.top) / scale + 4;
      setPosition({
        left,
        top:
          below + height <= host.offsetHeight - 8
            ? below
            : Math.max(8, (a.top - h.top) / scale - height - 4),
      });
    };
    place();
    panel.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const outside = (event: PointerEvent) => {
      if (!panel.current?.contains(event.target as Node) && !anchor.contains(event.target as Node))
        close.current();
    };
    const scroll = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) close.current();
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("resize", place);
    document.addEventListener("scroll", scroll, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("resize", place);
      document.removeEventListener("scroll", scroll, true);
    };
  }, [host, anchorRef, height]);
  if (!host) return null;
  return createPortal(
    <div
      ref={panel}
      className={className}
      role="menu"
      aria-label={label}
      style={{ height, position: "absolute", zIndex: 60, ...position }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close.current();
          if (anchorRef.current?.isConnected) anchorRef.current.focus();
        }
        if (event.key === "Tab") close.current();
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"),
          );
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[
            (index + (event.key === "ArrowDown" ? 1 : buttons.length - 1)) % buttons.length
          ]?.focus();
        }
      }}
    >
      {children}
    </div>,
    host,
  );
}
