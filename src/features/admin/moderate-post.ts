import { isCommunityOwner } from "./permissions";
import type { Community } from "@/features/screens/community-card";
import { isPreviewMode } from "@/features/preview/preview-mode";
export async function moderateCommunityPost(community: Community, userId: number | null, postId: number) {
  if (!isCommunityOwner(community, userId)) throw new Error("커뮤니티 개설자만 삭제할 수 있습니다.");
  if (!isPreviewMode()) throw new Error("현재 관리자 게시글 삭제를 사용할 수 없습니다.");
  const { moderatePreviewCommunityPost } = await import("@/features/preview/demo-api");
  moderatePreviewCommunityPost(community.galleryId, userId, postId);
}
