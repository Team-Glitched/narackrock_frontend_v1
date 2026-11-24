import type { TrackDto } from "@/lib/api/composition";

type ViewerPermission = {
  userId: number;
  canContribute: boolean;
  canEdit?: boolean;
};

export function hasOwnDraftClip(tracks: TrackDto[], userId: number) {
  return tracks.some((track) =>
    track.clips.some((clip) => clip.ownerId === userId && clip.approvalStatus === "DRAFT"),
  );
}

export function canCreateLayer(
  permission: ViewerPermission,
  tracks: TrackDto[],
  ownProject = false,
) {
  if (ownProject && permission.canEdit) return true;
  return (
    permission.canContribute &&
    !tracks.some((track) => track.ownerId === permission.userId && track.originOpenSourceId == null)
  );
}

/** Places imported open-source sample tracks below all regular participant layers while preserving order. */
export function orderStudioTracks<T extends Pick<TrackDto, "originOpenSourceId">>(
  tracks: readonly T[],
): T[] {
  return [
    ...tracks.filter((track) => track.originOpenSourceId == null),
    ...tracks.filter((track) => track.originOpenSourceId != null),
  ];
}

export function shouldShowContributionSubmit(
  shortId: number | null,
  permission: ViewerPermission,
  tracks: TrackDto[],
) {
  return shortId != null && permission.canContribute && hasOwnDraftClip(tracks, permission.userId);
}

export function shouldOfferSongPublish(
  shortId: number | null,
  permission: { canExport: boolean },
  tracks: TrackDto[],
) {
  return shortId == null && permission.canExport && tracks.some((track) => track.clips.length > 0);
}
