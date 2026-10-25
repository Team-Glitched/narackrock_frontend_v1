"use client";
import { useRef } from "react";
import type { ShortItemDto } from "@/lib/api/contracts";
export function AlbumCarousel({ items, index, onPrevious, onNext }: {
  items: ShortItemDto[]; index: number; onPrevious: () => void; onNext: () => void;
}) {
  const gesture = useRef<{ x: number; y: number; id: number } | null>(null);
  return <div className="abyss-cover-viewport" role="region" aria-roledescription="캐러셀" aria-label="숏폼 앨범" tabIndex={0}
    onKeyDown={event => { if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); if (event.key === "ArrowLeft") onPrevious(); else onNext(); } }}
    onPointerDown={event => { if (event.button !== 0) return; gesture.current = { x: event.clientX, y: event.clientY, id: event.pointerId }; event.currentTarget.setPointerCapture(event.pointerId); }}
    onPointerUp={event => {
      const start = gesture.current; gesture.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      if (!start || start.id !== event.pointerId) return;
      const dx = event.clientX - start.x; const dy = event.clientY - start.y;
      if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.3) { if (dx < 0) onNext(); else onPrevious(); }
    }} onPointerCancel={() => { gesture.current = null; }}>
    <div className="abyss-cover-track" style={{ transform: `translateX(calc(${index} * -1 * var(--cover-step, 360px)))` }}>
      {items.map((item, position) => item.albumImageUrl ?
        // eslint-disable-next-line @next/next/no-img-element
        <img key={item.shortId} src={item.albumImageUrl} alt={position === index ? `${item.title} 앨범 커버` : ""} aria-hidden={position !== index} className="abyss-cover" draggable={false} loading={Math.abs(position - index) > 1 ? "lazy" : "eager"} />
        : <div key={item.shortId} className="abyss-cover abyss-cover-empty" role="img" aria-label={`${item.title} 앨범 이미지 없음`} aria-hidden={position !== index} />)}
    </div>
    <span className="sr-only" aria-live="polite">{index + 1} / {items.length}, {items[index]?.title}</span>
  </div>;
}
