"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** The Figma canvases are 390×844 and 844×390. Scale the whole canvas,
 * never independently shrink its icons, text, or available content height. */
export function DesignViewport({ landscape = false, children }: { landscape?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    const touchPortrait = window.matchMedia("(pointer: coarse) and (orientation: portrait)");
    let fullHeight=host.clientHeight;
    let normalScale=1;
    const viewport=window.visualViewport;
    const fit = () => {
      const editable=document.activeElement instanceof HTMLElement&&document.activeElement.matches('input:not([type=range]):not([type=file]),textarea,[contenteditable=true]');
      const keyboardVisible=!landscape&&window.matchMedia("(pointer: coarse)").matches&&editable&&Boolean(viewport&&viewport.height<fullHeight*0.8);
      host.dataset.keyboardVisible=String(keyboardVisible);
      if(keyboardVisible&&viewport){
        host.style.height=`${viewport.height}px`;
        host.style.setProperty("--visible-canvas-height",`${Math.min(844,viewport.height/normalScale)}px`);
        return;
      }
      host.style.height="";
      fullHeight=host.clientHeight;
      const rotated = landscape && touchPortrait.matches;
      const width = landscape ? 844 : 390;
      const height = landscape ? 390 : 844;
      const scale = Math.min(host.clientWidth / (rotated ? height : width), host.clientHeight / (rotated ? width : height), 1);
      normalScale=scale;
      host.style.setProperty("--canvas-scale", String(scale));
      host.dataset.rotated = String(rotated);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    touchPortrait.addEventListener("change", fit);
    let frame=0;
    const focusChanged=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(fit);};
    viewport?.addEventListener("resize",fit);
    viewport?.addEventListener("scroll",fit);
    document.addEventListener("focusin",focusChanged);
    document.addEventListener("focusout",focusChanged);
    fit();
    return () => { observer.disconnect(); touchPortrait.removeEventListener("change", fit);viewport?.removeEventListener("resize",fit);viewport?.removeEventListener("scroll",fit);document.removeEventListener("focusin",focusChanged);document.removeEventListener("focusout",focusChanged);cancelAnimationFrame(frame); };
  }, [landscape]);
  return <main ref={ref} className={`design-viewport${landscape ? " design-viewport--landscape" : ""}`}>
    <div className="design-canvas">{children}</div>
  </main>;
}
