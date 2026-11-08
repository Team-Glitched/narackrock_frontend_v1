import type { ShortItemDto } from "@/lib/api/contracts";

type ParticipationShort = Pick<
  ShortItemDto,
  "completionStatus" | "projectId" | "hasPendingContribution" | "hasApprovedContribution"
> & {
  participants: Array<Pick<ShortItemDto["participants"][number], "userId" | "role">>;
};

/**
 * The viewer's relation to a short's project, shown in the button under the player:
 * - `owner`: the viewer made the song.
 * - `contributed`: an approved contribution, or a non-owner participant.
 * - `pending`: the viewer's contribution request is still under review.
 * - `joinable`: an in-progress song the viewer can still join.
 * `null` means no button (no project, or a completed song the viewer has no part in).
 */
export type ShortParticipation = "owner" | "contributed" | "pending" | "joinable";

export function shortParticipation(
  short: ParticipationShort,
  currentUserId: number | null,
): ShortParticipation | null {
  if (short.projectId == null) return null;
  const mine = currentUserId == null ? [] : short.participants.filter((p) => p.userId === currentUserId);
  if (mine.some((p) => p.role === "OWNER")) return "owner";
  if (short.hasApprovedContribution || mine.length > 0) return "contributed";
  if (short.hasPendingContribution) return "pending";
  return short.completionStatus === "IN_PROGRESS" ? "joinable" : null;
}
