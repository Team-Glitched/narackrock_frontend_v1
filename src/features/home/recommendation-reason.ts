import type { ShortRecommendationReason } from "@/lib/api/contracts";

export const recommendationReasonLabel: Record<ShortRecommendationReason, string> = {
  FOLLOWED_ARTIST: "팔로우한 작곡가의 곡",
  SAVED_ARTIST: "저장한 곡의 작곡가",
  LIKED_ARTIST: "좋아요한 곡의 작곡가",
  COLLABORATOR: "함께 작업한 작곡가의 곡",
  DISCOVERY: "새 작곡가 발견",
};
