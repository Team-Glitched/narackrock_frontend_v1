import type { ShortItemDto } from "@/lib/api/contracts";

type JoinableShort = Pick<ShortItemDto, "completionStatus" | "projectId"> & {
  participants: Array<Pick<ShortItemDto["participants"][number], "userId">>;
};

export function canJoinShort(short: JoinableShort, currentUserId: number | null): boolean {
  if (short.completionStatus !== "IN_PROGRESS" || short.projectId == null) return false;
  return currentUserId == null || !short.participants.some((participant) => participant.userId === currentUserId);
}
