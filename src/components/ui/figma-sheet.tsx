import { sharedStyles } from "@/styles/shared.styles";
import { createPortal } from "react-dom";
import { useEffect, useRef, type ReactNode } from "react";
import { usePortalHost } from "./use-portal-host";
/** Figma V3 390 × 721 bottom sheet shared by notifications and participants. */
export function FigmaSheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const host = usePortalHost(".phone-frame");
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, [host]);
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
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
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
        <div className={sharedStyles.figmaSheetContent}>{children}</div>
      </section>
    </div>,
    host,
  );
}
