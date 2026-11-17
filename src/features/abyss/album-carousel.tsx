import { abyssStyles } from "@/styles/abyss.styles";
import { useLayoutEffect, useRef } from "react";
import type { ShortItemDto } from "@/lib/api/contracts";
import defaultCover from "./assets/shortform-default-cover.png";
export function AlbumCarousel({
  items,
  index,
  cycle,
  onPrevious,
  onNext,
}: {
  items: ShortItemDto[];
  index: number;
  cycle: { key: number; previous: ShortItemDto; direction: "next" | "previous" } | null;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const gesture = useRef<{ x: number; y: number; id: number } | null>(null);
  const track = useRef<HTMLDivElement>(null);
  function resetDrag() {
    const element = track.current;
    if (!element) return;
    element.style.removeProperty("transition");
    element.style.removeProperty("translate");
  }
  const leadingCover = cycle?.direction === "next";
  const coverIndex = index + (leadingCover ? 1 : 0);
  const covers = cycle
    ? leadingCover ? [cycle.previous, ...items] : [...items, cycle.previous]
    : items;
  const cycleCoverPosition = leadingCover ? 0 : items.length;

  useLayoutEffect(() => {
    if (!cycle || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = track.current?.animate(
      [{ translate: cycle.direction === "next" ? "var(--cover-step, 320px)" : "calc(-1 * var(--cover-step, 320px))" }, { translate: "0px" }],
      { duration: 320, easing: "cubic-bezier(.22,.61,.36,1)" },
    );
    return () => animation?.cancel();
  }, [cycle]);

  return (
    <div
      className={abyssStyles.abyssCoverViewport}
      role="region"
      aria-roledescription="캐러셀"
      aria-label="숏폼 앨범"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
          event.preventDefault();
          if (event.key === "ArrowLeft") onPrevious();
          else onNext();
        }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        gesture.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        const start = gesture.current;
        const element = track.current;
        if (!start || start.id !== event.pointerId || !element) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(dy)) return;
        const viewport = event.currentTarget;
        const scale = viewport.getBoundingClientRect().width / viewport.offsetWidth || 1;
        const distance = dx / scale;
        const offset = Math.sign(distance) * (220 * Math.abs(distance)) / (220 + Math.abs(distance));
        element.style.transition = "none";
        element.style.translate = `${offset}px`;
      }}
      onPointerUp={(event) => {
        const start = gesture.current;
        gesture.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        resetDrag();
        if (!start || start.id !== event.pointerId) return;
        const dx = event.clientX - start.x;
        const dy = event.clientY - start.y;
        if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.3) {
          if (dx < 0) onNext();
          else onPrevious();
        }
      }}
      onPointerCancel={() => {
        gesture.current = null;
        resetDrag();
      }}
    >
      <div
        key={cycle?.key ?? 0}
        ref={track}
        className={abyssStyles.abyssCoverTrack}
        style={{ transform: `translateX(calc(${coverIndex} * -1 * var(--cover-step, 320px)))` }}
      >
        {covers.map((item, position) => (
          <img
            key={cycle && position === cycleCoverPosition ? "previous-cycle" : item.shortId}
            src={item.albumImageUrl?.trim() || defaultCover}
            alt={position === coverIndex ? `${item.title} 앨범 커버` : ""}
            aria-hidden={position !== coverIndex}
            className={abyssStyles.abyssCover}
            draggable={false}
            loading={Math.abs(position - coverIndex) > 1 ? "lazy" : "eager"}
          />
        ))}
      </div>
      <span className={"sr-only"} aria-live="polite">
        {index + 1} / {items.length}, {items[index]?.title}
      </span>
    </div>
  );
}
