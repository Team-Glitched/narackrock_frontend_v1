import { PostCommentsScreen } from "@/features/screens/post-comments";
import { useAppNavigation } from "@/features/navigation/use-app-navigation";
import { readId } from "@/features/navigation/paths";
import { useRouteCommunity } from "@/features/community/use-route-community";
import { useAppSession } from "@/app/session";
import { isCommunityOwner } from "@/features/admin/permissions";
import { moderateCommunityPost } from "@/features/admin/moderate-post";
export default function PostPage() {
  const { to, back, params, galleryId } = useAppNavigation();
  const { currentUserId } = useAppSession();
  const result = useRouteCommunity(galleryId);
  const community = result.status === "ready" ? result.community : null;
  return <PostCommentsScreen key={params.postId} postId={readId(params.postId)!} onHidden={() => back(galleryId ? `/communities/${galleryId}` : "/posts")} onProfile={id => to(`/users/${id}`)} moderation={community && isCommunityOwner(community, currentUserId) ? { galleryId: community.galleryId, remove: id => moderateCommunityPost(community, currentUserId, id) } : undefined} />;
}
