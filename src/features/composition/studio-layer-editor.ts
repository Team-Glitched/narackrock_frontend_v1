import type { TrackDto } from "../../lib/api/composition.ts";
import { supportsMidi } from "./instrument-parts.ts";

type Permission = { userId: number; canEdit: boolean; canContribute: boolean };
type Layer = Pick<TrackDto, "trackId" | "ownerId" | "instrument" | "approvalStatus"> & {
  clips: readonly unknown[];
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
