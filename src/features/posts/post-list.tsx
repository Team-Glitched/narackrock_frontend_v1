import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";
import { uiLabels } from "@/lib/ui-labels";
import { useHiddenPosts } from "@/features/community/hidden-posts";
import { useEffect, useRef, useState } from "react";
import { Avatar, IconSlot } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useGalleryPosts } from "@/features/community/use-gallery-posts";
import { DEFAULT_GALLERY_ID, fetchPost } from "@/lib/api/community";
import type { PostListItem } from "@/lib/api/contracts";
import { relativeTime } from "@/features/posts/post-utils";

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
  post: PostListItem;
  onOpen: (postId: number) => void;
}) {
  const hiddenPosts = useHiddenPosts();
  const [excerpt, setExcerpt] = useState(post.title);
  useEffect(() => {
    let active = true;
    fetchPost(post.postId)
      .then((detail) => {
        if (active) setExcerpt(detail.content || detail.title);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [post.postId]);
  if (hiddenPosts.ids.has(post.postId)) return null;
  return (
    <button
      type="button"
      className={cn(communityStyles.miniPost, tall ? communityStyles.miniPostTall : "")}
      data-post-id={post.postId}
      onClick={() => onOpen(post.postId)}
      aria-label={`${post.title} 게시글 열기`}
    >
      <span className={communityStyles.postThumb}>
        {post.imageUrl && (
          <img src={post.imageUrl} alt="게시글 첨부 이미지" width={90} height={90} />
        )}
      </span>
      <div className={communityStyles.miniPostCopy}>
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
  );
}

export function PostsScreen({
  onOpenPost,
}: {
  go: Navigate;
  onOpenPost: (postId: number) => void;
}) {
  const posts = useGalleryPosts(DEFAULT_GALLERY_ID, { sort: "POPULAR" });
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
