export type CommunityOwnership = { ownerId?: number };
/** Missing ownership is not permission; community ownership is never platform administration. */
export function isCommunityOwner(community: CommunityOwnership, userId: number | null) {
  return userId !== null && community.ownerId !== undefined && community.ownerId === userId;
}
export function canManageCommunityMember(
  community: CommunityOwnership,
  userId: number | null,
  memberId: number,
) {
  return isCommunityOwner(community, userId) && memberId !== community.ownerId;
}
