import { isCommunityOwner } from "./permissions";
import type { Community } from "@/features/community/community-card";
export async function moderateCommunityPost(
  community: Community,
  userId: number | null,
  postId: number,
) {
  if (!isCommunityOwner(community, userId))
    throw new Error("커뮤니티 개설자만 삭제할 수 있습니다.");
  if (!Number.isSafeInteger(postId) || postId <= 0) throw new Error("올바르지 않은 게시글입니다.");
  throw new Error("현재 관리자 게시글 삭제를 사용할 수 없습니다.");
}
