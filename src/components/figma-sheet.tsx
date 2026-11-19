import { sharedStyles } from "@/styles/shared.styles";
import { createPortal } from "react-dom";
import { useEffect, useRef, type PointerEvent, type ReactNode } from "react";
import { usePortalHost } from "./use-portal-host";
import { sheetSnap } from "./sheet-snap";
const SNAP_TRANSITION = "height .24s cubic-bezier(.22,.61,.36,1)";

type SheetDrag = {
  id: number;
  y: number;
  height: number;
  /** The stylesheet's full height, measured once when the drag starts. */
  full: number;
  scale: number;
  moved: boolean;
};

/**
 * Figma V3 390 × 721 bottom sheet shared by notifications and participants. `resizable` lets the top edge
 * be dragged: released low it closes, near the middle it rests at half height, higher it returns to full.
 */
export function FigmaSheet({
  title,
  onClose,
  children,
  resizable = false,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  resizable?: boolean;
}) {
  const host = usePortalHost(".phone-frame");
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<SheetDrag | null>(null);
  // The height the sheet rests at: null is the stylesheet's full height.
  const restingHeight = useRef<number | null>(null);
  const settleTimer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(settleTimer.current), []);

  // Animates from the released height. Nothing here may measure another height first: a forced layout at a
  // different height would become the transition's start, and the sheet would jump before settling.
  function settle(target: number | null, full: number, then?: () => void) {
    const element = panel.current;
    if (!element) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    void element.offsetHeight; // commit the released height as the transition's start
    element.style.transition = reduced ? "none" : SNAP_TRANSITION;
    element.style.height = `${target ?? full}px`;
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(
      () => {
        element.style.removeProperty("transition");
        if (target === null) element.style.removeProperty("height");
        then?.();
      },
      reduced ? 0 : 240,
    );
  }

  // The stylesheet's full height, read with the drag height lifted for a moment (only before a drag starts).
  function fullHeight(element: HTMLElement) {
    const current = element.style.height;
    element.style.removeProperty("height");
    const full = element.offsetHeight;
    element.style.height = current;
    return full;
  }

  const dragHandlers = {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
      const element = panel.current;
      if (event.button !== 0 || !element) return;
      window.clearTimeout(settleTimer.current);
      element.style.removeProperty("transition");
      drag.current = {
        id: event.pointerId,
        y: event.clientY,
        height: element.offsetHeight,
        full: element.style.height ? fullHeight(element) : element.offsetHeight,
        // The design canvas may scale the phone frame; heights are in its unscaled pixels.
        scale: element.getBoundingClientRect().height / element.offsetHeight || 1,
        moved: false,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const start = drag.current;
      const element = panel.current;
      if (!start || start.id !== event.pointerId || !element) return;
      const dy = (event.clientY - start.y) / start.scale;
      if (!start.moved && Math.abs(dy) < 4) return;
      start.moved = true;
      element.style.height = `${Math.max(0, Math.min(start.full, start.height - dy))}px`;
    },
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      const start = drag.current;
      drag.current = null;
      const element = panel.current;
      if (!start || start.id !== event.pointerId || !element) return;
      // A tap on the handle closes, as the grip always has.
      if (!start.moved) return onClose();
      const frame = element.parentElement?.clientHeight ?? element.offsetHeight;
      const snap = sheetSnap(element.offsetHeight, frame);
      if (snap === "closed") return settle(0, start.full, onClose);
      restingHeight.current = snap === "half" ? Math.round(frame / 2) : null;
      settle(restingHeight.current, start.full);
    },
    onPointerCancel() {
      const start = drag.current;
      if (!start) return;
      drag.current = null;
      settle(restingHeight.current, start.full);
    },
  };
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [host]);
  useEffect(() => {
    if (!host) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs[dialogs.length - 1] !== panel.current) return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [host, onClose]);
  if (!host) return null;
  return createPortal(
    <div className={sharedStyles.figmaSheetOverlay}>
      <button
        className={sharedStyles.figmaSheetBackdrop}
        aria-label={`${title} 닫기`}
        onClick={onClose}
      />
      <section
        ref={panel}
        className={sharedStyles.figmaSheetPanel}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
            ),
          ];
          const first = controls[0],
            last = controls[controls.length - 1];
          if (!first) {
            event.preventDefault();
            return;
          }
          if (
            event.shiftKey &&
            (document.activeElement === first || document.activeElement === event.currentTarget)
          ) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        <button
          className={sharedStyles.figmaSheetGrip}
          aria-label={`${title} 닫기`}
          onClick={onClose}
        />
        {resizable && (
          <div className={sharedStyles.figmaSheetDragHandle} aria-hidden="true" {...dragHandlers} />
        )}
        <div className={sharedStyles.figmaSheetContent}>{children}</div>
      </section>
    </div>,
    host,
  );
}
