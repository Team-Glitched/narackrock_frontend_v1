import type {
  CompositionDto,
  ContributionDto,
  ContributionItem,
} from "../../lib/api/composition.ts";

export const requestStatus = {
  PENDING: "대기 중",
  APPROVED: "수락됨",
  REJECTED: "거절됨",
} as const;

export function requestAge(createdAt: string, now = Date.now()): string {
  const timestamp = Date.parse(createdAt);
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60000));
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

export function canReviewRequest(
  item: Pick<ContributionDto, "userId" | "approvalStatus">,
  permission:
    | Pick<CompositionDto["viewerPermission"], "userId" | "canReviewContribution">
    | undefined,
): boolean {
  return (
    item.approvalStatus === "PENDING" &&
    permission?.canReviewContribution === true &&
    item.userId !== permission.userId
  );
}

/** A new clip can be submitted on an existing track; highlight that track as well. */
export function contributionTrackIds(
  items: readonly Pick<ContributionItem, "changeType" | "targetType" | "targetId">[],
  tracks: readonly { trackId: number; clips: readonly { clipId: number }[] }[],
): Set<number> {
  const added = items.filter((item) => item.changeType === "ADD");
  const trackIds = new Set(
    added.filter((item) => item.targetType === "TRACK").map((item) => item.targetId),
  );
  const clipIds = new Set(
    added.filter((item) => item.targetType === "CLIP").map((item) => item.targetId),
  );
  return new Set(
    tracks
      .filter(
        (track) =>
          trackIds.has(track.trackId) || track.clips.some((clip) => clipIds.has(clip.clipId)),
      )
      .map((track) => track.trackId),
  );
}
