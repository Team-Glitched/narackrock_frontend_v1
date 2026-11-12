import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";
import { uiLabels } from "@/lib/ui-labels";
import { useHiddenPosts } from "@/features/community/hidden-posts";
import { useRef } from "react";
import { Avatar } from "@/components/avatar";
import { IconSlot } from "@/components/icon-slot";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useGalleryPosts } from "@/features/community/use-gallery-posts";
import type { PostListItem } from "@/lib/api/contracts";
import { relativeTime } from "@/features/posts/post-utils";
import { PopularContentActions } from "@/features/posts/popular-content-actions";
import { PostCommunityLabel } from "@/features/posts/post-community-label";

export function PostListStatus({ state }: { state: "loading" | "error" | "empty" }) {
  const message =
    state === "loading"
      ? "게시글을 불러오는 중..."
      : state === "error"
        ? "게시글을 불러오지 못했습니다."
        : "아직 게시글이 없어요.";
  return (
    <p className={sharedStyles.emptyCommunity} style={{ height: "auto", padding: "40px 20px" }}>
      {message}
    </p>
  );
}

export function MiniPost({
  tall = false,
  post,
  onOpen,
}: {
  tall?: boolean;
  post: PostListItem & { content?: string };
  onOpen: (postId: number) => void;
}) {
  const hiddenPosts = useHiddenPosts();
  const excerpt = post.content || post.contentPreview || post.title;
  if (hiddenPosts.ids.has(post.postId)) return null;
  return (
    <div className={cn(communityStyles.miniPost, tall ? communityStyles.miniPostTall : "")} data-post-id={post.postId}>
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center text-left"
        onClick={() => onOpen(post.postId)}
        aria-label={`${post.title} 게시글 열기`}
        aria-description={post.gallery?.name ? `커뮤니티 ${post.gallery.name}` : undefined}
      >
      <span className={communityStyles.postThumb}>
        {post.imageUrl && (
          <img src={post.imageUrl} alt="게시글 첨부 이미지" width={90} height={90} />
        )}
      </span>
      <div className={communityStyles.miniPostCopy}>
        <PostCommunityLabel name={post.gallery?.name} />
        <strong>{excerpt}</strong>
        <div className={communityStyles.miniMeta} aria-label="게시글 통계">
          <span>{relativeTime(post.createdAt)}</span>
          <span>
            <IconSlot name="like.svg" kind="mini" />
            {post.likeCount}
          </span>
          <span>
            <IconSlot name="mini-comment.svg" kind="mini" />
            {post.commentCount}
          </span>
        </div>
        <div className={communityStyles.miniAuthor}>
          <Avatar src={post.writer.profileImageUrl} />
          <span>{post.writer.nickname}</span>
        </div>
      </div>
      </button>
      <PopularContentActions kind="post" id={post.postId} title={post.title} ownerId={post.writer.userId} />
    </div>
  );
}

export function PostsScreen({
  onOpenPost,
}: {
  onOpenPost: (postId: number) => void;
}) {
  const posts = useGalleryPosts("popular");
  const rootRef = useRef<HTMLDivElement>(null);
  const sentinel = useInfiniteScroll({
    rootRef,
    enabled: posts.hasMore && !posts.appending && !posts.appendFailed,
    onLoadMore: posts.loadMore,
  });
  return (
    <div ref={rootRef} className={cn(sharedStyles.listView, sharedStyles.scrollContent)}>
      <h1 className={sharedStyles.postsListTitle}>{uiLabels.popularPosts}</h1>
      <div className={sharedStyles.postsList}>
        {posts.status !== "ready" ? (
          <PostListStatus state={posts.status} />
        ) : posts.posts.length === 0 ? (
          <PostListStatus state="empty" />
        ) : (
          posts.posts.map((post) => (
            <MiniPost tall key={post.postId} post={post} onOpen={onOpenPost} />
          ))
        )}
      </div>
      {posts.hasMore && (
        <div ref={sentinel} className={communityStyles.postFeedSentinel} aria-hidden="true" />
      )}
      {posts.appendFailed && <button onClick={posts.loadMore}>다시 시도</button>}
    </div>
  );
}
