import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { pointerAxes } from "@/features/composition/pointer-coordinates";
import { MAX_ZOOM, MIN_ZOOM, clampCrop, cropDisplay, defaultCrop, panCrop, type ThumbnailCrop } from "./thumbnail-crop";

/** Square editing area; the inscribed circle is exactly what list and detail cards show. */
const viewport = 300;
const smallPreview = 40;
const thumb = 18;

/**
 * The area outside the crop circle is dimmed. Drag or use the arrow keys to move, and use the slider or wheel to zoom.
 */
export function ThumbnailCropper({ file, crop, onChange, disabled = false }: {
  file: File;
  crop: ThumbnailCrop;
  onChange: (crop: ThumbnailCrop) => void;
  disabled?: boolean;
}) {
  const [decoded, setDecoded] = useState<{ file: File; bitmap: ImageBitmap | null } | null>(null);
  const size = decoded?.file === file ? decoded.bitmap : null;
  const drag = useRef<{ pointerId: number; x: number; y: number; crop: ThumbnailCrop } | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const editorPreview = useRef<HTMLCanvasElement>(null);
  const listPreview = useRef<HTMLCanvasElement>(null);
  const current = size ? clampCrop(crop, size.width, size.height) : crop;
  const latest = useRef({ current, size, onChange, disabled });

  useEffect(() => {
    let active = true;
    let bitmap: ImageBitmap | undefined;
    // Decode the same still frame as renderThumbnail, including for animated files.
    void createImageBitmap(file).then((result) => {
      if (!active) {
        result.close();
        return;
      }
      bitmap = result;
      setDecoded({ file, bitmap });
    }, () => {
      if (active) setDecoded({ file, bitmap: null });
    });
    return () => {
      active = false;
      bitmap?.close();
    };
  }, [file]);

  useLayoutEffect(() => {
    for (const canvas of [editorPreview.current, listPreview.current]) {
      const context = canvas?.getContext("2d");
      if (!canvas || !context) continue;
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (!size) continue;
      const { left, top, width, height } = cropDisplay(crop, size.width, size.height, canvas.width);
      context.imageSmoothingQuality = "high";
      context.drawImage(size, left, top, width, height);
    }
  }, [crop, size]);

  useEffect(() => {
    latest.current = { current, size, onChange, disabled };
  });

  // React's onWheel is passive, so preventDefault (to keep the page from scrolling while zooming) needs a native listener.
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      const { current: value, size: image, onChange: change, disabled: off } = latest.current;
      if (!image || off) return;
      event.preventDefault();
      change(clampCrop({ ...value, zoom: value.zoom * Math.exp(-event.deltaY / 500) }, image.width, image.height));
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);

  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!size || disabled || event.button !== 0) return;
    event.preventDefault();
    const point = pointerAxes(event.currentTarget, event);
    drag.current = { pointerId: event.pointerId, x: point.x, y: point.y, crop: current };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId || !size) return;
    const point = pointerAxes(event.currentTarget, event);
    onChange(panCrop(active.crop, point.x - active.x, point.y - active.y, size.width, size.height, viewport));
  }
  function pointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div
        ref={frame}
        role="application"
        aria-label="앨범 이미지 위치 편집. 끌어서 이동, 방향키로 미세 이동"
        tabIndex={disabled ? -1 : 0}
        className="relative shrink-0 cursor-grab touch-none overflow-hidden rounded-[4px] bg-app-surface outline-offset-4 active:cursor-grabbing"
        style={{ width: viewport, height: viewport }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerEnd}
        onPointerCancel={pointerEnd}
        onLostPointerCapture={pointerEnd}
        onKeyDown={(event) => {
          if (!size || disabled) return;
          const step = event.shiftKey ? 20 : 5;
          const delta = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[event.key];
          if (!delta) return;
          event.preventDefault();
          onChange(panCrop(current, delta[0], delta[1], size.width, size.height, viewport));
        }}
      >
        <canvas
          ref={editorPreview}
          role="img"
          aria-label="앨범 이미지 미리보기"
          width={viewport}
          height={viewport}
          className="pointer-events-none absolute inset-0"
        />
        {/* The shadow dims the corners without drawing a second image behind translucent pixels. */}
        <span
          className="pointer-events-none absolute inset-0 rounded-full border-2 border-solid border-app-fg"
          style={{ boxShadow: `0 0 0 ${viewport}px rgb(0 0 0 / 40%)` }}
          aria-hidden="true"
        />
      </div>
      {decoded?.file === file && !size && <p role="alert">앨범 이미지를 미리 볼 수 없습니다. 다른 이미지를 선택해주세요.</p>}
      <label className="flex w-full max-w-[260px] items-center gap-2 text-caption text-app-muted">
        확대
        <input
          type="range"
          aria-label="앨범 이미지 확대"
          // The create form styles every input with padding and a border; reset them so the thumb reaches both ends.
          className={[
            "!m-0 !h-[5px] !min-h-0 !w-auto min-w-0 flex-1 cursor-pointer appearance-none !rounded-full !border-0 !p-0",
            "disabled:cursor-default disabled:opacity-40",
            "[&::-webkit-slider-thumb]:h-[18px] [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:appearance-none",
            "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-app-primary",
            "[&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-app-primary",
          ].join(" ")}
          style={{
            // Fill up to the thumb centre, which travels from half a thumb inside the left end to the right end.
            background: `linear-gradient(to right, var(--purple) calc(${thumb / 2}px + (100% - ${thumb}px) * ${
              (current.zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)}), var(--white) 0)`,
          }}
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={current.zoom}
          disabled={!size || disabled}
          onChange={(event) => size && onChange(clampCrop({ ...current, zoom: Number(event.target.value) }, size.width, size.height))}
        />
        <output className="w-9 text-right tabular-nums">{current.zoom.toFixed(1)}×</output>
      </label>
      <div className="flex items-center gap-3 text-caption text-app-muted">
        <span className="relative block shrink-0 overflow-hidden rounded-full border border-solid border-app-fg bg-app-surface"
          style={{ width: smallPreview, height: smallPreview }} aria-hidden="true">
          <canvas ref={listPreview} width={smallPreview} height={smallPreview} className="size-full" />
        </span>
        목록에서는 이렇게 보여요
        <button type="button" className="underline disabled:opacity-40" disabled={!size || disabled}
          onClick={() => onChange(defaultCrop())}>
          처음 위치로
        </button>
      </div>
    </div>
  );
}
