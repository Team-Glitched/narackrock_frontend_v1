import { useLayoutEffect, useRef, useState, type PointerEvent } from "react";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { designTokens } from "@/styles/tokens";
import { creationTarget } from "./creation-target";
import { useUrlNavigation } from "./use-url-navigation";

type CreateScope = "posts" | "communities" | "sources";
type Position = { x: number; y: number };
type Drag = {
  pointerId: number;
  startX: number;
  startY: number;
  origin: Position;
};

const width = 104;
const height = 50;
const inset = Number.parseFloat(designTokens.spacing.gutter);
const clamp = (value: number) => Math.max(0, Math.min(1, value));

// Leave room to scroll the last card above the floating action.
export const contextualCreateArea = `${sharedStyles.screenBody} relative [&_.scroll-content]:pb-[90px]! [&_.community-directory]:pb-[90px]!`;

export function ContextualCreate({ scope, galleryId }: { scope: CreateScope; galleryId?: number | null }) {
  const { to } = useUrlNavigation();
  const target = creationTarget(scope, galleryId);
  const label = scope === "posts" ? "글쓰기" : "만들기";
  const [position, setPosition] = useState<Position>({ x: 1, y: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const [topInset, setTopInset] = useState(inset);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const drag = useRef<Drag | null>(null);
  const dragged = useRef(false);

  useLayoutEffect(() => {
    const area = buttonRef.current?.parentElement;
    if (!area) return;
    const headers = [...area.querySelectorAll("[data-create-boundary]")];
    const measure = () => {
      const bounds = area.getBoundingClientRect();
      if (!bounds.height) return;
      const headerBottom = Math.max(0, ...headers.map((header) =>
        (header.getBoundingClientRect().bottom - bounds.top) * area.clientHeight / bounds.height,
      ));
      setTopInset(Math.min(Math.ceil(headerBottom) + inset, Math.max(0, area.clientHeight - height - inset)));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(area);
    headers.forEach((header) => observer.observe(header));
    return () => observer.disconnect();
  }, []);

  function move(event: PointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    const area = event.currentTarget.parentElement;
    if (!start || start.pointerId !== event.pointerId || !area) return;
    const dx = event.clientX - start.startX;
    const dy = event.clientY - start.startY;
    if (!dragged.current) {
      if (Math.hypot(dx, dy) < 6) return;
      dragged.current = true;
      setIsDragging(true);
    }

    // The phone canvas may be visually scaled to fit the browser viewport.
    const bounds = area.getBoundingClientRect();
    const travelX = (area.clientWidth - width - 2 * inset) * (bounds.width / area.clientWidth);
    const travelY = (area.clientHeight - height - topInset - inset) * (bounds.height / area.clientHeight);
    setPosition({
      x: travelX > 0 ? clamp(start.origin.x + dx / travelX) : start.origin.x,
      y: travelY > 0 ? clamp(start.origin.y + dy / travelY) : start.origin.y,
    });
  }

  function stop(event: PointerEvent<HTMLButtonElement>) {
    if (drag.current?.pointerId !== event.pointerId) return;
    drag.current = null;
    if (!dragged.current) return;
    setIsDragging(false);
    setPosition((old) => ({ x: Math.round(old.x), y: Math.round(old.y) }));
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      className={cn(
        "absolute z-[5] inline-flex touch-none cursor-grab items-center justify-center gap-2 rounded-[37px] bg-app-primary font-sans text-label font-semibold whitespace-nowrap text-[var(--neutral-100)] select-none active:cursor-grabbing motion-reduce:transition-none",
        isDragging
          ? "motion-safe:scale-[.96] motion-safe:transition-[scale] motion-safe:duration-100"
          : "motion-safe:transition-[left,top,scale] motion-safe:duration-350 motion-safe:ease-[cubic-bezier(.22,.8,.35,1.12)]",
      )}
      style={{
        width,
        height,
        left: `calc(${inset}px + max(0px, 100% - ${width + 2 * inset}px) * ${position.x})`,
        top: `calc(${topInset}px + max(0px, 100% - ${height + topInset + inset}px) * ${position.y})`,
      }}
      aria-label={scope === "posts" ? label : `${label}: ${target.label}`}
      aria-description="끌어 놓으면 가까운 모서리에 붙습니다. 키보드에서는 방향키로 옮깁니다."
      onPointerDown={(event) => {
        if (!event.isPrimary || event.button !== 0) return;
        dragged.current = false;
        const button = event.currentTarget;
        const area = button.parentElement;
        const origin = area
          ? {
              x: clamp((button.offsetLeft - inset) / Math.max(1, area.clientWidth - width - 2 * inset)),
              y: clamp((button.offsetTop - topInset) / Math.max(1, area.clientHeight - height - topInset - inset)),
            }
          : position;
        drag.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, origin };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onKeyDown={(event) => {
        const x = event.key === "ArrowLeft" ? 0 : event.key === "ArrowRight" ? 1 : undefined;
        const y = event.key === "ArrowUp" ? 0 : event.key === "ArrowDown" ? 1 : undefined;
        if (x === undefined && y === undefined) return;
        event.preventDefault();
        setPosition((old) => ({ x: x ?? old.x, y: y ?? old.y }));
      }}
      onClick={(event) => {
        if (event.detail !== 0 && dragged.current) return;
        to(target.path);
      }}
    >
      <span
        aria-hidden="true"
        className="relative size-[18px] shrink-0 before:absolute before:inset-x-0 before:top-2 before:h-0.5 before:rounded-sm before:bg-current after:absolute after:inset-y-0 after:left-2 after:w-0.5 after:rounded-sm after:bg-current"
      />
      {label}
    </button>
  );
}
