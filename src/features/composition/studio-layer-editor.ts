import type { ClipDto, TrackDto, CompositionView } from "../../lib/api/composition.ts";
import { supportsMidi } from "./instrument-parts.ts";

type Permission = { userId: number; canEdit: boolean; canContribute: boolean };
type Layer = Pick<TrackDto, "trackId" | "ownerId" | "instrument" | "approvalStatus" | "originOpenSourceId"> & {
  clips: readonly Pick<ClipDto, "clipId" | "clipType">[];
};

/** Empty tracks reserve the owner's layer while editing; they must remain reachable after leaving. */
export function emptyLayerEditor(permission: Permission, projectStatus: string, track: Layer) {
  return track.originOpenSourceId == null &&
    track.ownerId === permission.userId &&
    track.clips.length === 0 &&
    supportsMidi(track.instrument) &&
    ["DRAFT", "APPROVED"].includes(track.approvalStatus) &&
    ["DRAFT", "IN_PROGRESS"].includes(projectStatus) &&
    (permission.canEdit || permission.canContribute)
    ? { trackId: track.trackId, clipId: null }
    : null;
}

/** Existing MIDI is viewable even for teammates; new notes require an editable own layer. */
export function layerEditorTarget(permission: Permission, projectStatus: string, track: Layer) {
  const midi = track.clips.find((clip) => clip.clipType === "MIDI");
  return midi
    ? { trackId: track.trackId, clipId: midi.clipId > 0 ? midi.clipId : null }
    : emptyLayerEditor(permission, projectStatus, track);
}

/** Public studio permissions describe note editing; an approved layer's owner can still change its tone. */
export function canChangeTrackInstrument(userId: number, projectStatus: string, track: Layer) {
  return (
    track.originOpenSourceId == null &&
    track.ownerId === userId &&
    ["DRAFT", "IN_PROGRESS"].includes(projectStatus) &&
    ["DRAFT", "APPROVED"].includes(track.approvalStatus)
  );
}

/** Approved playback stays isolated; open an owner's editable MIDI in their personal workspace. */
export function midiEditorView(
  userId: number,
  projectStatus: string,
  track:
    | (Omit<Layer, "clips"> & {
        clips: readonly Pick<ClipDto, "clipId" | "clipType" | "ownerId" | "approvalStatus">[];
      })
    | undefined,
  clipId: number | null,
  view: CompositionView,
): CompositionView {
  if (
    typeof view !== "string" ||
    !track ||
    !canChangeTrackInstrument(userId, projectStatus, track) ||
    !supportsMidi(track.instrument)
  )
    return view;
  const clip = track.clips.find((item) => item.clipId === clipId);
  return clip?.clipType === "MIDI" &&
    clip.ownerId === userId &&
    ["DRAFT", "APPROVED"].includes(clip.approvalStatus)
    ? "working"
    : view;
}
