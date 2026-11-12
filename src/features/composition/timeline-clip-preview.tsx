import { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import type { ClipDto } from "@/lib/api/composition";
import { queryScope } from "@/lib/query";
import { midiPreviewHeight, midiPreviewNotes } from "./midi-preview-notes";
import { waveformPeaks } from "./waveform-peaks";

const waveformBars = 96;

function AudioClipPreview({ url, offsetMs, durationMs }: {
  url: string;
  offsetMs: number;
  durationMs: number;
}) {
  const userId = useCurrentUserId();
  const { data: peaks } = useQuery({
    queryKey: [...queryScope(userId), "clip-waveform", url, offsetMs, durationMs],
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const response = await fetch(url, { signal });
      if (!response.ok) throw new Error("오디오 파형을 불러올 수 없습니다.");
      const bytes = await response.arrayBuffer();
      signal.throwIfAborted();
      // Decode without starting live audio, and cache only the preview's peaks.
      const context = new OfflineAudioContext(1, 1, 22_050);
      const buffer = await context.decodeAudioData(bytes);
      signal.throwIfAborted();
      return waveformPeaks(buffer, waveformBars, offsetMs, durationMs);
    },
  });
  if (!peaks) return null;
  const upper = peaks.map((peak, index) => `L${index + 0.5} ${(16 - peak * 13).toFixed(2)}`);
  const lower = peaks.map((peak, index) => `L${index + 0.5} ${(16 + peak * 13).toFixed(2)}`);
  const envelope = `M0 16${upper.join("")}L${waveformBars} 16${lower.reverse().join("")}Z`;

  return (
    <svg
      className="block size-full"
      viewBox={`0 0 ${waveformBars} 32`}
      preserveAspectRatio="none"
      aria-hidden="true"
      data-clip-preview="waveform"
    >
      <path
        d={`M0 16H${waveformBars}`}
        stroke="currentColor"
        strokeOpacity="0.4"
        vectorEffect="non-scaling-stroke"
      />
      <path d={envelope} fill="currentColor" fillOpacity="0.86" />
    </svg>
  );
}

export const TimelineClipPreview = memo(function TimelineClipPreview({ clip }: { clip: ClipDto }) {
  if (clip.clipType === "AUDIO") {
    return clip.mediaUrl && clip.durationMs > 0 ? (
      <AudioClipPreview url={clip.mediaUrl} offsetMs={clip.clipOffsetMs} durationMs={clip.durationMs} />
    ) : null;
  }

  const notes = midiPreviewNotes(clip.midiNotes ?? [], clip.durationTick);
  if (notes.length === 0) return null;
  return (
    <svg
      className="block size-full"
      viewBox={`0 0 ${clip.durationTick} ${midiPreviewHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      data-clip-preview="midi"
      fill="currentColor"
    >
      {notes.map(({ startTick, durationTick, y }, index) => (
        <rect
          key={index}
          x={startTick}
          y={y - 2.25}
          width={durationTick}
          height={4.5}
          rx={Math.min(durationTick / 2, clip.durationTick * 0.016)}
          ry={1.25}
        />
      ))}
    </svg>
  );
});
