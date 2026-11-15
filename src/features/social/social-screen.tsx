import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/styles/variants";
import { useGalleryRole } from "@/features/community/use-gallery-role";
import { CommunityDirectory } from "../community/community-directory";
import type { Community } from "../community/community-card";
import { useGalleryPosts } from "@/features/community/use-gallery-posts";
import { DEFAULT_GALLERY_ID } from "@/lib/api/community";
import { PostListStatus } from "@/features/posts/post-list";
import { CommunityPost } from "@/features/posts/post-card";
import { FriendsScreen, type FriendsListKind } from "@/features/social/friends-screen";

import type { PostSort } from "@/lib/api/contracts";
export type CommunityTab = "posts" | "community" | "friends";

// tab은 page.tsx가 들고 있다 — "모두보기"로 전체 목록에 다녀와도 커뮤니티 탭이 유지되도록.
export function CommunityScreen({
  onProfile,
  onChat,
  onJoined,
  tab,
  onTabChange,
  onComments,
  onOpenCommunity,
  sort = "LATEST",
  onOpenFriendsList,
}: {
  onProfile: (id: number) => void;
  onChat: (userId: number) => void;
  onJoined: () => void;
  tab: CommunityTab;
  onTabChange: (tab: CommunityTab) => void;
  onComments: (postId: number) => void;
  onOpenCommunity: (community: Community) => void;
  sort?: PostSort;
  onOpenFriendsList?: (kind: FriendsListKind) => void;
}) {
  const posts = useGalleryPosts(DEFAULT_GALLERY_ID, { sort });
  const { role } = useGalleryRole(DEFAULT_GALLERY_ID);

  return (
    <div className={cn(communityStyles.communityView, sharedStyles.socialScreen)}>
      <div className={communityStyles.communityTabs} aria-label="소셜 메뉴" data-create-boundary>
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
                moderation={{ galleryId: DEFAULT_GALLERY_ID, canManage: Boolean(role?.canManage) }}
                onChanged={posts.refetch}
                onProfile={onProfile}
                onComments={onComments}
              />
            ))
          )}
          {posts.hasMore && (
            <div className={communityStyles.postFeedEnd} role="status">
              {posts.appendFailed && <p role="alert">게시글을 더 불러오지 못했습니다.</p>}
              <button
                className={buttonVariants({ tone: "secondary", size: "compact" })}
                disabled={posts.appending}
                onClick={posts.loadMore}
              >
                {posts.appending ? "불러오는 중..." : posts.appendFailed ? "다시 시도" : "더보기"}
              </button>
            </div>
          )}
        </div>
      ) : tab === "friends" ? (
        <FriendsScreen onOpenList={onOpenFriendsList} onProfile={onProfile} onChat={onChat} />
      ) : (
        <CommunityDirectory onJoined={onJoined} onOpen={onOpenCommunity} />
      )}
    </div>
  );
}
