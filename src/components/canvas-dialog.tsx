import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { createPortal } from "react-dom";
import { useEffect, useEffectEvent, useRef, type ReactNode } from "react";
import { usePortalHost } from "./use-portal-host";

export function CanvasDialog({
  className,
  titleId,
  onClose,
  children,
}: {
  className: string;
  titleId: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const host = usePortalHost(".design-canvas");
  const overlay = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // A disabled control cannot take focus; fall back to the dialog itself so Escape and Tab stay inside it.
    (
      panel.current?.querySelector<HTMLElement>(
        "[autofocus]:not(:disabled), button:not(:disabled), input:not(:disabled), select:not(:disabled)",
      ) ?? panel.current
    )?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [host]);
  const closeDialog = useEffectEvent(onClose);
  useEffect(() => {
    if (!host) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const dialogs = host.querySelectorAll('[role="dialog"]');
      if (dialogs[dialogs.length - 1] !== overlay.current) return;
      event.preventDefault();
      closeDialog();
    };
    // Disabling a focused save button can move focus to body. Escape must still close the top dialog.
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [host]);
  if (!host) return null;
  return createPortal(
    <div
      ref={overlay}
      className={sharedStyles.canvasDialogOverlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        className={sharedStyles.canvasDialogBackdrop}
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
      />
      <div
        ref={panel}
        className={cn("canvas-dialog-panel", className)}
        tabIndex={-1}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const controls = [
            ...event.currentTarget.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]',
            ),
          ];
          const first = controls[0],
            last = controls[controls.length - 1];
          if (!first) {
            event.preventDefault();
            return;
          }
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }}
      >
        {children}
      </div>
    </div>,
    host,
  );
}
