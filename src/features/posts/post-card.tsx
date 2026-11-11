import { useLoginPrompt } from "@/features/auth/login-prompt";
import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { useHiddenPosts } from "@/features/community/hidden-posts";
import { PostMemberModeration } from "@/features/admin/post-member-moderation";
import { canSanction, type ModerationScope } from "@/features/community/use-gallery-role";
import { PostUserActionsMenu } from "@/features/posts/post-user-actions-menu";
import { FigmaSheet } from "@/components/figma-sheet";
import { ReportReasons } from "@/features/comments/report-reasons";
import { PostActions } from "@/features/posts/post-actions";
import { PostCommunityLabel } from "@/features/posts/post-community-label";
import { usePostInteractions } from "@/features/posts/use-post-interactions";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
import { deletePost, moderateGalleryContent, updatePost } from "@/lib/api/community";
import type { PostListItem } from "@/lib/api/contracts";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { applyPostEdit, applyPostRemoval, postDetailQuery } from "@/features/posts/post-queries";
import { postError, relativeTime } from "@/features/posts/post-utils";
import { reportPost } from "@/lib/api/reports";

type CommunityPostProps = {
  moderation?: ModerationScope;
  post: PostListItem;
  onChanged: () => void;
  onComments: (postId: number) => void;
  onProfile?: (userId: number) => void;
};

/** A post card. `moderation` (from the gallery role) enables moderator deletion and member sanctions. */
export function CommunityPost(props: CommunityPostProps) {
  const currentUserId = useCurrentUserId();
  return <ScopedCommunityPost key={`${currentUserId}:${props.post.postId}`} {...props} currentUserId={currentUserId} />;
}

function ScopedCommunityPost({
  post,
  onChanged,
  onComments,
  onProfile,
  moderation,
  currentUserId,
}: CommunityPostProps & { currentUserId: number | null }) {
  const owner = currentUserId === post.writer.userId;
  const canModerate = Boolean(moderation?.canManage);
  const canModerateMember = canSanction(moderation, currentUserId, post.writer.userId);
  const [moderationReason, setModerationReason] = useState("");
  const [memberAction, setMemberAction] = useState<"suspend" | "expel" | null>(null);
  const [moderationNotice, setModerationNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const optionButton = useRef<HTMLButtonElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const hiddenPosts = useHiddenPosts();
  const { requireLogin } = useLoginPrompt();
  const [reportOpen, setReportOpen] = useState(false);
  const queryClient = useQueryClient();
  // The detail (preview, reactions, saved state) is requested once the card nears the viewport.
  const [nearViewport, setNearViewport] = useState(() => typeof IntersectionObserver === "undefined");
  const detailQuery = useQuery({
    ...postDetailQuery(currentUserId, post.postId),
    enabled: currentUserId !== null && nearViewport,
  });
  const detail = detailQuery.data ?? null;
  const interactions = usePostInteractions(post.postId, detail);
  const detailStatus = detailQuery.isError ? "unavailable" : "loading";
  const saveStatus = currentUserId === null || interactions.bookmarked !== undefined
    ? "ready"
    : detailStatus;
  const voteStatus = currentUserId === null || interactions.reaction ? "ready" : detailStatus;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState("");
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const error = actionError ?? (detailQuery.isLoadingError ? postError(detailQuery.error) : null);
  const preview = detail?.content ?? null;
  const imageUrl = detail ? detail.imageUrl : post.imageUrl;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const moderating = canModerate && !owner;

  const saving = useMutation({
    mutationFn: (edit: { title: string; content: string }) => updatePost(post.postId, edit.title, edit.content),
    onSuccess: (_response, edit) => {
      applyPostEdit(queryClient, currentUserId, post.postId, edit.title, edit.content);
      setEditing(false);
      onChanged();
    },
    onError: (cause) => setActionError(postError(cause)),
  });
  const removal = useMutation({
    mutationFn: (moderationScope: { galleryId: number; reason: string } | null) =>
      moderationScope
        ? moderateGalleryContent(moderationScope.galleryId, "posts", post.postId, moderationScope.reason)
        : deletePost(post.postId),
    onSuccess: () => {
      applyPostRemoval(queryClient, currentUserId, post.postId);
      onChanged();
    },
    onError: (cause) => {
      setActionError(postError(cause));
      setConfirmDelete(false);
    },
  });
  // A deleted post stays disabled until the list reloads without it.
  const submitting = loadingEdit || saving.isPending || removal.isPending || removal.isSuccess;

  useEffect(() => {
    const article = articleRef.current;
    if (currentUserId === null || nearViewport || !article) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      setNearViewport(true);
    }, { rootMargin: "300px 0px" });
    observer.observe(article);
    return () => observer.disconnect();
  }, [currentUserId, nearViewport]);

  async function startEdit() {
    setMenuOpen(false);
    setActionError(null);
    setLoadingEdit(true);
    try {
      // Edit the server's current text, not a possibly older cached copy.
      const fresh = await queryClient.fetchQuery({ ...postDetailQuery(currentUserId, post.postId), staleTime: 0 });
      setTitle(fresh.title);
      setContent(fresh.content);
      setEditing(true);
    } catch (cause) {
      setActionError(postError(cause));
    } finally {
      setLoadingEdit(false);
    }
  }

  function saveEdit() {
    if (!title.trim() || !content.trim()) {
      setActionError("제목과 내용을 모두 입력해주세요.");
      return;
    }
    if (submitting) return;
    setActionError(null);
    saving.mutate({ title, content });
  }

  function remove() {
    setMenuOpen(false);
    if (moderating && !moderationReason.trim()) {
      setActionError("운영 삭제 사유를 입력해주세요.");
      return;
    }
    if (submitting) return;
    setActionError(null);
    removal.mutate(
      moderating && moderation ? { galleryId: moderation.galleryId, reason: moderationReason.trim() } : null,
    );
  }

  if (hiddenPosts.ids.has(post.postId)) return null;

  if (editing) {
    return (
      <article ref={articleRef} className={communityStyles.communityPost} data-post-id={post.postId}>
        <div className={communityStyles.postForm}>
          <input
            aria-label="게시글 제목 수정"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            disabled={submitting}
          />
          <textarea
            aria-label="게시글 내용 수정"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="내용을 입력하세요"
            disabled={submitting}
          />
          {error && <p className={communityStyles.postFormError}>{error}</p>}
          <div className={communityStyles.postFormActions}>
            <button
              className={buttonVariants({
                tone: "secondary",
                size: "compact",
              })}
              onClick={() => setEditing(false)}
              disabled={submitting}
            >
              취소
            </button>
            <button
              className={buttonVariants({
                tone: "primary",
                size: "compact",
              })}
              onClick={saveEdit}
              disabled={submitting}
            >
              {submitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article ref={articleRef} className={communityStyles.communityPost} data-post-id={post.postId}>
      {interactions.shareDialog}
      <div className={communityStyles.communityAuthor}>
        <button
          className={communityStyles.postAuthorLink}
          aria-label={`${post.writer.nickname} 프로필`}
          onClick={() => onProfile?.(post.writer.userId)}
        >
          <Avatar src={post.writer.profileImageUrl} />
          <strong>{post.writer.nickname || "알 수 없는 사용자"}</strong>
        </button>
        <span>• {relativeTime(post.createdAt)}</span>
        <button
          ref={optionButton}
          disabled={submitting}
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-label="게시글 더보기"
        >
          <Asset name="post-more.svg" />
        </button>
      </div>
      {menuOpen && !owner && (
        <PostUserActionsMenu
          onSuspendMember={
            canModerateMember
              ? () => {
                  setMenuOpen(false);
                  setMemberAction("suspend");
                }
              : undefined
          }
          onExpelMember={
            canModerateMember
              ? () => {
                  setMenuOpen(false);
                  setMemberAction("expel");
                }
              : undefined
          }
          onModerateDelete={
            canModerate
              ? () => {
                  setConfirmDelete(true);
                  setMenuOpen(false);
                }
              : undefined
          }
          anchorRef={optionButton}
          onClose={() => setMenuOpen(false)}
          onReport={() => {
            setMenuOpen(false);
            if (requireLogin()) setReportOpen(true);
          }}
          onHide={() => {
            setMenuOpen(false);
            hiddenPosts.hide(post.postId);
          }}
        />
      )}
      {memberAction && moderation && (
        <PostMemberModeration
          community={moderation}
          member={post.writer}
          action={memberAction}
          onClose={() => setMemberAction(null)}
          onDone={(message) => {
            setMemberAction(null);
            setModerationNotice(message);
          }}
        />
      )}
      {moderationNotice && (
        <p className={communityStyles.postModerationNotice} role="status">
          {moderationNotice}
        </p>
      )}
      {reportOpen && (
        <FigmaSheet title="신고" onClose={() => setReportOpen(false)}>
          <ReportReasons
            onSubmit={(reason, description) => reportPost(post.postId, reason, description)}
            onDone={() => setReportOpen(false)}
          />
        </FigmaSheet>
      )}
      {menuOpen && owner && (
        <PostUserActionsMenu
          anchorRef={optionButton}
          onClose={() => setMenuOpen(false)}
          onReport={() => {}}
          onHide={() => {}}
          onEdit={startEdit}
          onDelete={() => {
            setConfirmDelete(true);
            setMenuOpen(false);
          }}
        />
      )}
      <div className="flex items-center gap-3 [&>span]:max-w-[45%] [&>span]:shrink-0">
        <h2 className="min-w-0 flex-1">
          <button
            className={communityStyles.postRead}
            disabled={submitting}
            onClick={() => onComments(post.postId)}
          >
            {post.title}
          </button>
        </h2>
        <PostCommunityLabel name={post.gallery?.name} />
      </div>
      {(currentUserId === null || preview) && (
        <button
          className={communityStyles.postPreview}
          onClick={() => onComments(post.postId)}
          disabled={submitting}
        >
          {currentUserId === null ? "로그인 후 게시글 내용을 확인할 수 있어요." : preview}
        </button>
      )}
      {error && (
        <p className={communityStyles.postFormError} role="alert">
          {error}
        </p>
      )}
      {confirmDelete && (
        <div
          className={communityStyles.postDeleteConfirm}
          role="group"
          aria-label="게시글 삭제 확인"
        >
          <p>{moderating ? "운영자 권한으로 이 게시글을 삭제할까요?" : "이 게시글을 삭제할까요?"}</p>
          {moderating && (
            <input
              aria-label="운영 삭제 사유"
              placeholder="삭제 사유"
              maxLength={500}
              value={moderationReason}
              onChange={(event) => setModerationReason(event.target.value)}
            />
          )}
          <button
            className={buttonVariants({
              tone: "secondary",
            })}
            disabled={submitting}
            onClick={() => setConfirmDelete(false)}
          >
            취소
          </button>
          <button
            className={buttonVariants({
              tone: "primary",
            })}
            disabled={submitting || (moderating && !moderationReason.trim())}
            onClick={remove}
          >
            {submitting ? "삭제 중..." : "삭제 확인"}
          </button>
        </div>
      )}
      {imageUrl && (
        <button
          className={communityStyles.postImageOpen}
          aria-label={`${post.title} 게시글 열기`}
          onClick={() => onComments(post.postId)}
        >
          <img
            className={communityStyles.communityImage}
            src={imageUrl}
            alt="게시글 첨부 이미지"
            width={350}
            height={262}
          />
        </button>
      )}
      <PostActions
        likeCount={interactions.reaction?.likeCount ?? post.likeCount}
        dislikeCount={interactions.reaction?.dislikeCount}
        commentCount={post.commentCount}
        vote={interactions.reaction?.isLiked ? "like" : interactions.reaction?.isDisliked ? "dislike" : null}
        voteStatus={voteStatus}
        busy={interactions.busy}
        onVote={(kind) => void interactions.vote(kind)}
        onComments={() => onComments(post.postId)}
        saved={interactions.bookmarked}
        saveStatus={saveStatus}
        onSave={() => void interactions.toggleBookmark()}
        onShare={() => void interactions.share(post.title)}
      />
      {interactions.notice && (
        <p className={communityStyles.postFormError} role="status">
          {interactions.notice}
        </p>
      )}
    </article>
  );
}
