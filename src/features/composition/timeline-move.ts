import type { ClipDto, CompositionDto } from "../../lib/api/composition.ts";
export function canMoveClip(
  permission: CompositionDto["viewerPermission"],
  clip: Pick<ClipDto, "ownerId" | "approvalStatus">,
) {
  return (
    clip.ownerId === permission.userId &&
    (permission.canEdit || (permission.canContribute && clip.approvalStatus === "DRAFT"))
  );
}
export function snappedClipStart(
  original: number,
  deltaPx: number,
  stepTick: number,
  maxTick: number,
  durationTick: number,
  cellPx = 20,
) {
  const step = Math.max(Number.EPSILON, stepTick),
    limit = Math.max(0, Math.floor((maxTick - durationTick) / step) * step);
  return Math.max(
    0,
    Math.min(limit, Math.round((original + (deltaPx / cellPx) * step) / step) * step),
  );
}
export function overlapsClip(
  clip: Pick<ClipDto, "clipId" | "durationTick">,
  startTick: number,
  siblings: readonly Pick<ClipDto, "clipId" | "startTick" | "durationTick">[],
) {
  return siblings.some(
    (other) =>
      other.clipId !== clip.clipId &&
      startTick < other.startTick + other.durationTick &&
      startTick + clip.durationTick > other.startTick,
  );
}
