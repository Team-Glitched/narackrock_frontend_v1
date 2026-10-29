import type { ShortItemDto } from "@/lib/api/contracts";

type JoinableShort = Pick<ShortItemDto,
  "completionStatus" | "projectId" | "hasPendingContribution" | "hasApprovedContribution"> & {
  participants: Array<Pick<ShortItemDto["participants"][number], "userId">>;
};

export function canJoinShort(short: JoinableShort, currentUserId: number | null): boolean {
  if (short.completionStatus !== "IN_PROGRESS" || short.projectId == null
    || short.hasPendingContribution || short.hasApprovedContribution) {
    return false;
  }
  return currentUserId == null || !short.participants.some((participant) => participant.userId === currentUserId);
}


export function canEditOwnShort(short: Pick<ShortItemDto, "completionStatus" | "projectId" | "author">, currentUserId: number | null): boolean {
  return currentUserId !== null && short.author.userId === currentUserId
    && short.projectId !== null && short.completionStatus === "IN_PROGRESS";
}
