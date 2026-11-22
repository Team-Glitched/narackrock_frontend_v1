import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { logicalBounds, pointerAxes } from "@/features/composition/pointer-coordinates";
import {
  MAX_ZOOM,
  MIN_ZOOM,
  clampCrop,
  cropDisplay,
  panCrop,
  pinchCrop,
  type CropPoint,
  type ThumbnailCrop,
} from "./image-crop";

/** Square editing area; the inscribed circle is exactly what list and detail cards show. */
const viewport = 300;
const smallPreview = 40;
const thumb = 18;

type Gesture =
  | { kind: "pan"; point: CropPoint; crop: ThumbnailCrop }
  | { kind: "pinch"; centre: CropPoint; distance: number; crop: ThumbnailCrop };

function fingerPair(points: Map<number, CropPoint>) {
  const [first, second] = [...points.values()];
  return {
    centre: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    distance: Math.max(1, Math.hypot(second.x - first.x, second.y - first.y)),
  };
}

/**
 * The area outside the crop circle is dimmed. Drag or use the arrow keys to move, and use the slider or wheel to zoom.
 */
export function ImageCropper({
  file,
  crop,
  onChange,
  disabled = false,
  shape = "circle",
  label = "앨범 이미지",
  onReady,
}: {
  file: File;
  crop: ThumbnailCrop;
  onChange: (crop: ThumbnailCrop) => void;
  disabled?: boolean;
  shape?: "circle" | "square";
  label?: string;
  onReady?: (ready: boolean) => void;
}) {
  const [decoded, setDecoded] = useState<{ file: File; bitmap: ImageBitmap | null } | null>(null);
  const size = decoded?.file === file ? decoded.bitmap : null;
  const points = useRef(new Map<number, CropPoint>());
  const gesture = useRef<Gesture | null>(null);
  const frame = useRef<HTMLDivElement>(null);
  const editorPreview = useRef<HTMLCanvasElement>(null);
  const listPreview = useRef<HTMLCanvasElement>(null);
  const current = size ? clampCrop(crop, size.width, size.height) : crop;
  const latest = useRef({ current, size, onChange, disabled });

  useEffect(() => {
    onReady?.(Boolean(size));
  }, [size, onReady]);

  useEffect(() => {
    let active = true;
    let bitmap: ImageBitmap | undefined;
    const activePoints = points.current;
    // Decode the same still frame as renderThumbnail, including for animated files.
    void createImageBitmap(file).then(
      (result) => {
        if (!active) {
          result.close();
          return;
        }
        bitmap = result;
        setDecoded({ file, bitmap });
      },
      () => {
        if (active) setDecoded({ file, bitmap: null });
      },
    );
    return () => {
      active = false;
      bitmap?.close();
      activePoints.clear();
      gesture.current = null;
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
      change(
        clampCrop(
          { ...value, zoom: value.zoom * Math.exp(-event.deltaY / 500) },
          image.width,
          image.height,
        ),
      );
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, []);

  function emitCrop(next: ThumbnailCrop) {
    latest.current.current = next;
    onChange(next);
  }
  function restartGesture() {
    const crop = latest.current.current;
    gesture.current =
      points.current.size === 2
        ? { kind: "pinch", ...fingerPair(points.current), crop }
        : points.current.size === 1
          ? { kind: "pan", point: [...points.current.values()][0], crop }
          : null;
  }
  function localPoint(event: ReactPointerEvent<HTMLDivElement>) {
    const point = pointerAxes(event.currentTarget, event);
    const bounds = logicalBounds(event.currentTarget);
    return { x: point.x - bounds.left, y: point.y - bounds.top };
  }
  function pointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!size || disabled || event.button !== 0 || points.current.size >= 2) return;
    event.preventDefault();
    points.current.set(event.pointerId, localPoint(event));
    restartGesture();
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const active = gesture.current;
    if (!active || !points.current.has(event.pointerId) || !size || disabled) return;
    const point = localPoint(event);
    points.current.set(event.pointerId, point);
    const frameSize = frame.current?.offsetWidth || viewport;
    if (active.kind === "pinch" && points.current.size === 2) {
      const pair = fingerPair(points.current);
      emitCrop(
        pinchCrop(
          active.crop,
          pair.distance / active.distance,
          active.centre,
          pair.centre,
          size.width,
          size.height,
          frameSize,
        ),
      );
    } else if (active.kind === "pan") {
      emitCrop(
        panCrop(
          active.crop,
          point.x - active.point.x,
          point.y - active.point.y,
          size.width,
          size.height,
          frameSize,
        ),
      );
    }
  }
  function pointerEnd(event: ReactPointerEvent<HTMLDivElement>) {
    if (points.current.delete(event.pointerId)) restartGesture();
  }

  return (
    <div className="flex w-full flex-col items-center gap-3">
      <div
        ref={frame}
        role="application"
        aria-label={`${label} 위치 편집. 한 손가락으로 이동, 두 손가락으로 확대·축소, 방향키로 미세 이동`}
        tabIndex={disabled ? -1 : 0}
        className="relative shrink-0 cursor-grab touch-none overflow-hidden rounded-[4px] bg-app-surface outline-offset-4 active:cursor-grabbing"
        style={{ width: viewport, maxWidth: "100%", aspectRatio: "1" }}
        onPointerDown={pointerDown}
        onPointerMove={pointerMove}
        onPointerUp={pointerEnd}
        onPointerCancel={pointerEnd}
        onLostPointerCapture={pointerEnd}
        onKeyDown={(event) => {
          if (!size || disabled) return;
          const step = event.shiftKey ? 20 : 5;
          const delta = {
            ArrowLeft: [step, 0],
            ArrowRight: [-step, 0],
            ArrowUp: [0, step],
            ArrowDown: [0, -step],
          }[event.key];
          if (!delta) return;
          event.preventDefault();
          onChange(
            panCrop(
              current,
              delta[0],
              delta[1],
              size.width,
              size.height,
              frame.current?.offsetWidth || viewport,
            ),
          );
        }}
      >
        <canvas
          ref={editorPreview}
          role="img"
          aria-label={`${label} 미리보기`}
          width={viewport}
          height={viewport}
          className="pointer-events-none absolute inset-0 size-full"
        />
        {/* The shadow dims the corners without drawing a second image behind translucent pixels. */}
        <span
          className={`pointer-events-none absolute inset-0 border-2 border-solid border-app-fg ${shape === "circle" ? "rounded-full" : "rounded-[4px]"}`}
          style={{ boxShadow: `0 0 0 ${viewport}px rgb(0 0 0 / 40%)` }}
          aria-hidden="true"
        />
      </div>
      {decoded?.file === file && !size && (
        <p role="alert">이미지를 미리 볼 수 없습니다. 다른 이미지를 선택해주세요.</p>
      )}
      <label className="flex w-full max-w-[260px] items-center gap-2 text-caption text-app-muted">
        확대
        <input
          type="range"
          aria-label={`${label} 확대`}
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
              (current.zoom - MIN_ZOOM) / (MAX_ZOOM - MIN_ZOOM)
            }), var(--white) 0)`,
          }}
          min={MIN_ZOOM}
          max={MAX_ZOOM}
          step={0.01}
          value={current.zoom}
          disabled={!size || disabled}
          onChange={(event) =>
            size &&
            onChange(
              clampCrop({ ...current, zoom: Number(event.target.value) }, size.width, size.height),
            )
          }
        />
        <output className="w-9 text-right tabular-nums">{current.zoom.toFixed(1)}×</output>
      </label>
      <div className="flex items-center gap-3 text-caption text-app-muted">
        <span
          className={`relative block shrink-0 overflow-hidden border border-solid border-app-fg bg-app-surface ${shape === "circle" ? "rounded-full" : "rounded-[4px]"}`}
          style={{ width: smallPreview, height: smallPreview }}
          aria-hidden="true"
        >
          <canvas
            ref={listPreview}
            width={smallPreview}
            height={smallPreview}
            className="size-full"
          />
        </span>
        목록에서는 이렇게 보여요
      </div>
    </div>
  );
}
