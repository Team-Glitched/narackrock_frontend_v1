import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/styles/variants";
import { useGalleries } from "@/features/community/use-galleries";
import { CommunityDirectory } from "../community/community-directory";
import type { Community } from "../community/community-card";
import type { Navigate } from "@/features/navigation/types";
import { useGalleryPosts } from "@/features/community/use-gallery-posts";
import { DEFAULT_GALLERY_ID } from "@/lib/api/community";
import { PostListStatus } from "@/features/posts/post-list";
import { CommunityPost } from "@/features/posts/post-card";
import { FriendsScreen } from "@/features/social/friends-screen";

export type CommunityTab = "posts" | "community" | "friends";

// tab은 page.tsx가 들고 있다 — "모두보기"로 전체 목록에 다녀와도 커뮤니티 탭이 유지되도록.
export function CommunityScreen({
  go,
  tab,
  onTabChange,
  onComments,
  onOpenCommunity,
}: {
  go: Navigate;
  tab: CommunityTab;
  onTabChange: (tab: CommunityTab) => void;
  onComments: (postId: number) => void;
  onOpenCommunity: (community: Community) => void;
}) {
  const posts = useGalleryPosts(DEFAULT_GALLERY_ID);
  const galleries = useGalleries(0);

  return (
    <div className={cn(communityStyles.communityView, sharedStyles.socialScreen)}>
      <div className={communityStyles.communityTabs} aria-label="소셜 메뉴">
        <button
          aria-pressed={tab === "posts"}
          className={tab === "posts" ? sharedStyles.active : ""}
          onClick={() => onTabChange("posts")}
        >
          게시글
        </button>
        <button
          aria-pressed={tab === "community"}
          className={tab === "community" ? sharedStyles.active : ""}
          onClick={() => onTabChange("community")}
        >
          커뮤니티
        </button>
        <button
          aria-pressed={tab === "friends"}
          className={tab === "friends" ? sharedStyles.active : ""}
          onClick={() => onTabChange("friends")}
        >
          친구
        </button>
      </div>
      {tab === "posts" ? (
        <div className={cn(sharedStyles.socialPostFeed, sharedStyles.scrollContent)}>
          {posts.status !== "ready" ? (
            <div role="status">
              <PostListStatus state={posts.status} />
              {posts.status === "error" && (
                <button
                  className={cn(
                    buttonVariants({
                      tone: "secondary",
                    }),
                    communityStyles.communityRetry,
                  )}
                  onClick={posts.refetch}
                >
                  다시 시도
                </button>
              )}
            </div>
          ) : posts.posts.length === 0 ? (
            <PostListStatus state="empty" />
          ) : (
            posts.posts.map((post) => (
              <CommunityPost
                key={post.postId}
                post={post}
                postGalleryId={DEFAULT_GALLERY_ID}
                moderationCommunity={
                  galleries.status === "ready"
                    ? galleries.galleries.find(
                        (gallery) => gallery.galleryId === DEFAULT_GALLERY_ID,
                      )
                    : undefined
                }
                onChanged={posts.refetch}
                onProfile={(id) => go("profile", id)}
                onComments={onComments}
              />
            ))
          )}
        </div>
      ) : tab === "friends" ? (
        <FriendsScreen go={go} />
      ) : (
        <CommunityDirectory go={go} onOpen={onOpenCommunity} />
      )}
    </div>
  );
}
