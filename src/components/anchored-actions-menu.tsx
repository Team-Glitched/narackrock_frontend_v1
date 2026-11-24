import { createPortal } from "react-dom";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { usePortalHost } from "./use-portal-host";

/** Figma Menu / Post User Actions, 15236:41267. */
export function AnchoredActionsMenu({
  anchorRef,
  className,
  onClose,
  label,
  height = 99,
  width = 260,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  className: string;
  onClose: () => void;
  label: string;
  height?: number;
  width?: number;
  children: ReactNode;
}) {
  // Keep sheet actions above its backdrop and in the same coordinate system.
  const host = usePortalHost(".design-canvas", anchorRef);
  const panel = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);
  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    if (!host || !anchor) return;
    const place = () => {
      const h = host.getBoundingClientRect(),
        a = anchor.getBoundingClientRect();
      const scale = h.width / host.offsetWidth;
      const left = Math.max(
        8,
        Math.min((a.right - h.left) / scale - width, host.offsetWidth - width - 8),
      );
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
    // The portal is initially at (0, 0); focusing it must not scroll the page and
    // trigger the scroll-to-dismiss handler before the position is committed.
    panel.current
      ?.querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus({ preventScroll: true });
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
  }, [host, anchorRef, height, width]);
  if (!host) return null;
  return createPortal(
    <div
      ref={panel}
      className={className}
      role="menu"
      aria-label={label}
      style={{ height, width, position: "absolute", zIndex: 60, ...position }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          close.current();
          if (anchorRef.current?.isConnected) anchorRef.current.focus({ preventScroll: true });
        }
        if (event.key === "Tab") {
          // Tab must continue from the trigger, rather than a menu item that is about to unmount.
          if (anchorRef.current?.isConnected) anchorRef.current.focus({ preventScroll: true });
          close.current();
        }
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
