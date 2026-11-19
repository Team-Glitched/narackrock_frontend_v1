import type { ClipDto, TrackDto } from "../../lib/api/composition.ts";
import { supportsMidi } from "./instrument-parts.ts";

type Permission = { userId: number; canEdit: boolean; canContribute: boolean };
type Layer = Pick<TrackDto, "trackId" | "ownerId" | "instrument" | "approvalStatus"> & {
  clips: readonly Pick<ClipDto, "clipId" | "clipType">[];
};

/** Empty tracks reserve the owner's layer while editing; they must remain reachable after leaving. */
export function emptyLayerEditor(permission: Permission, projectStatus: string, track: Layer) {
  return track.ownerId === permission.userId &&
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
    track.ownerId === userId &&
    ["DRAFT", "IN_PROGRESS"].includes(projectStatus) &&
    ["DRAFT", "APPROVED"].includes(track.approvalStatus)
  );
}
