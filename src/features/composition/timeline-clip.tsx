import { studioStyles } from "@/styles/studio.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import type { ClipDto } from "@/lib/api/composition";
import { pointerAxes } from "./pointer-coordinates";
import { snappedClipStart } from "./timeline-move";
export function TimelineClip({
  clip,
  name,
  color,
  maxTick,
  stepTick,
  cellPx = 20,
  movable,
  onMove,
  onSelect,
  onEdit,
  onError,
}: {
  clip: ClipDto;
  name: string;
  color: string;
  maxTick: number;
  stepTick: number;
  cellPx?: number;
  movable: boolean;
  onMove: (tick: number) => Promise<void>;
  onSelect: () => void;
  onEdit?: () => void;
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
        clip.clipType === "MIDI" ? sharedStyles.midi : sharedStyles.audio,
        movable ? studioStyles.studioClipMovable : "",
      )}
      style={{
        backgroundColor: color,
        left: `${((position ?? clip.startTick) / maxTick) * 100}%`,
        width: `${Math.max(0.1, (clip.durationTick / maxTick) * 100)}%`,
      }}
      disabled={saving}
      aria-label={`${name} ${clip.clipType === "MIDI" ? "MIDI" : "오디오"} 클립`}
      aria-busy={saving}
      title={movable ? "끌어서 격자에 맞춰 이동 · 방향키로 한 칸 이동" : undefined}
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
        if (onEdit && event.detail === 0) {
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
        onEdit?.();
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
      <span className={"sr-only"}>
        {clip.clipType === "MIDI" ? `${clip.midiNotes.length} notes` : "Audio"}
      </span>
    </button>
  );
}
