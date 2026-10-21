import type { UserProfile } from "@/lib/api/contracts";

export function canSendChatTo(profile: Pick<UserProfile, "isPrivate" | "relations">): boolean {
  return !profile.isPrivate || (profile.relations.isFollowing && profile.relations.isFollowedBy);
}
