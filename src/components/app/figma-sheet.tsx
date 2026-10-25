"use client";
import { createPortal } from "react-dom";
import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
const subscribe = () => () => {};
const target = () => document.querySelector<HTMLElement>(".phone-frame");
const serverTarget = () => null;
/** Figma V3 390 × 721 bottom sheet shared by notifications and participants. */
export function FigmaSheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const host = useSyncExternalStore(subscribe, target, serverTarget);
  const panel = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [host]);
  if (!host) return null;
  return createPortal(<div className="figma-sheet-overlay"><button className="figma-sheet-backdrop" aria-label={`${title} 닫기`} onClick={onClose} />
    <section ref={panel} className="figma-sheet-panel" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} onKeyDown={event => {
        if (event.key === "Escape") { event.stopPropagation(); onClose(); }
        if (event.key !== "Tab") return;
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')];
        const first = controls[0], last = controls[controls.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}>
      <button className="figma-sheet-grip" aria-label={`${title} 닫기`} onClick={onClose} />
      <div className="figma-sheet-content">{children}</div>
    </section></div>, host);
}
