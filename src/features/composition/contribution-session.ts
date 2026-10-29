import type { TrackDto } from "@/lib/api/composition";

type ViewerPermission = {
  userId: number;
  canContribute: boolean;
};

export function hasOwnDraftClip(tracks: TrackDto[], userId: number) {
  return tracks.some((track) => track.clips.some((clip) =>
    clip.ownerId === userId && clip.approvalStatus === "DRAFT"));
}

export function canCreateLayer(permission: ViewerPermission, tracks: TrackDto[]) {
  return permission.canContribute
    && !tracks.some((track) => track.ownerId === permission.userId);
}

export function shouldShowContributionSubmit(shortId: number | null, permission: ViewerPermission, tracks: TrackDto[], workingDraftCount = 0) {
  return shortId != null
    && permission.canContribute
    && (hasOwnDraftClip(tracks, permission.userId) || workingDraftCount > 0);
}
