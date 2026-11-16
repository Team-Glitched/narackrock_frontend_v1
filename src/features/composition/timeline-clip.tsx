import { studioStyles } from "@/styles/studio.styles";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { AudioLines, Music2 } from "lucide-react";
import type { ClipDto } from "@/lib/api/composition";
import { pointerAxes } from "./pointer-coordinates";
import { snappedClipStart } from "./timeline-move";
import { TimelineClipPreview } from "./timeline-clip-preview";
import { partFor } from "./instrument-parts";

/** A clip's visible label (audio part · layer name) and its type label ("MIDI 클립" / "오디오 클립"). */
export function clipLabels(
  clip: Pick<ClipDto, "clipType" | "sourceType">,
  name: string,
  instrument: string | null,
) {
  const midi = clip.clipType === "MIDI";
  const recording = clip.sourceType === "RECORDING";
  const audioPart = midi ? undefined : partFor(instrument)?.label;
  const layerName = recording && name.trim() === "녹음 레이어" ? "" : name;
  const label =
    audioPart && layerName && layerName !== audioPart && !layerName.startsWith(`${audioPart} `)
      ? `${audioPart} · ${layerName}`
      : layerName || audioPart;
  return { label, clipTypeLabel: midi ? "MIDI 클립" : "오디오 클립" };
}

export function TimelineClip({
  clip,
  name,
  instrument,
  maxTick,
  stepTick,
  cellPx = 20,
  movable,
  onMove,
  onSelect,
  onEdit,
  openOnClick = false,
  onError,
}: {
  clip: ClipDto;
  name: string;
  instrument: string | null;
  maxTick: number;
  stepTick: number;
  cellPx?: number;
  movable: boolean;
  onMove: (tick: number) => Promise<void>;
  onSelect: () => void;
  onEdit?: () => void;
  openOnClick?: boolean;
  onError: (text: string) => void;
}) {
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    [],
  );
  const drag = useRef<{ x: number; tick: number; moved: boolean } | null>(null),
    ignoreClick = useRef(false);
  const [position, setPosition] = useState<number | null>(null),
    [saving, setSaving] = useState(false);
  const midi = clip.clipType === "MIDI";
  const ClipIcon = midi ? Music2 : AudioLines;
  const { label, clipTypeLabel } = clipLabels(clip, name, instrument);
  async function commit(tick: number) {
    if (tick === clip.startTick) {
      setPosition(null);
      return;
    }
    setSaving(true);
    try {
      await onMove(tick);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "클립을 이동하지 못했습니다.");
    } finally {
      setSaving(false);
      setPosition(null);
    }
  }
  return (
    <button
      className={cn(
        studioStyles.studioClip,
        midi ? studioStyles.studioClipMidi : studioStyles.studioClipAudio,
        movable ? studioStyles.studioClipMovable : "",
      )}
      style={{
        left: `${((position ?? clip.startTick) / maxTick) * 100}%`,
        width: `${Math.max(0.1, (clip.durationTick / maxTick) * 100)}%`,
      }}
      disabled={saving}
      aria-label={label ? `${label} ${clipTypeLabel}` : clipTypeLabel}
      aria-busy={saving}
      title={movable ? `${name} · 끌어서 이동하거나 방향키로 한 칸 이동` : (label ?? clipTypeLabel)}
      onPointerDown={(event) => {
        if (!movable || saving || event.button !== 0) return;
        drag.current = {
          x: pointerAxes(event.currentTarget, event).x,
          tick: clip.startTick,
          moved: false,
        };
        ignoreClick.current = false;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current) return;
        const delta = pointerAxes(event.currentTarget, event).x - drag.current.x;
        if (Math.abs(delta) > 3) drag.current.moved = true;
        if (drag.current.moved) {
          event.preventDefault();
          drag.current.tick = snappedClipStart(
            clip.startTick,
            delta,
            stepTick,
            maxTick,
            clip.durationTick,
            cellPx,
          );
          setPosition(drag.current.tick);
        }
      }}
      onPointerUp={(event) => {
        const ended = drag.current;
        if (!ended) return;
        drag.current = null;
        if (event.currentTarget.hasPointerCapture(event.pointerId))
          event.currentTarget.releasePointerCapture(event.pointerId);
        if (ended.moved) {
          ignoreClick.current = true;
          void commit(ended.tick);
        } else setPosition(null);
      }}
      onPointerCancel={() => {
        drag.current = null;
        setPosition(null);
      }}
      onLostPointerCapture={() => {
        if (drag.current) {
          drag.current = null;
          setPosition(null);
        }
      }}
      onClick={(event) => {
        if (ignoreClick.current) {
          ignoreClick.current = false;
          return;
        }
        if (onEdit && (openOnClick || event.detail === 0)) {
          onEdit();
          return;
        }
        if (onEdit) {
          if (clickTimer.current) clearTimeout(clickTimer.current);
          clickTimer.current = setTimeout(onSelect, 240);
        } else onSelect();
      }}
      onDoubleClick={() => {
        if (clickTimer.current) clearTimeout(clickTimer.current);
        if (!openOnClick) onEdit?.();
      }}
      onKeyDown={(event) => {
        if (!movable || saving || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        event.stopPropagation();
        const delta =
          event.key === "ArrowRight"
            ? cellPx
            : event.key === "ArrowLeft"
              ? -cellPx
              : event.key === "Home"
                ? -Infinity
                : Infinity;
        const tick = snappedClipStart(
          clip.startTick,
          delta,
          stepTick,
          maxTick,
          clip.durationTick,
          cellPx,
        );
        setPosition(tick);
        void commit(tick);
      }}
    >
      <span className={studioStyles.studioClipLabel} aria-hidden="true">
        <ClipIcon className="size-[11px] shrink-0" strokeWidth={1.8} />
        {label && (
          <span className="truncate text-[10px] leading-3 font-semibold text-app-fg">{label}</span>
        )}
      </span>
      <span className={studioStyles.studioClipPreview} aria-hidden="true">
        <TimelineClipPreview clip={clip} />
      </span>
    </button>
  );
}
