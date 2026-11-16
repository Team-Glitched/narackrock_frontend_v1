import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import type { NativeWork } from "@/lib/native-screens";
import type { Work } from "./workspace-store";

/** The same arrangement preview the web home draws: up to 4 tracks, clips as fractions of the song. */
export function nativeWork(work: Work): NativeWork {
  const tracks = work.composition.tracks.slice(0, 4);
  const end = Math.max(
    1,
    ...tracks.flatMap((track) => track.clips.map((clip) => clip.startTick + clip.durationTick)),
  );
  const visited = new Date(work.updatedAt);
  return {
    id: work.id,
    shortId: work.shortId,
    title: work.title,
    visitedLabel: Number.isNaN(visited.getTime())
      ? null
      : `${formatDistanceToNow(visited, { addSuffix: true, locale: ko })} 방문`,
    layerCount: work.composition.tracks.length,
    bpm: work.composition.project.bpm,
    preview: tracks.map((track) =>
      track.clips.map((clip) => ({ start: clip.startTick / end, length: clip.durationTick / end })),
    ),
  };
}
