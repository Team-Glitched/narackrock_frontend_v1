import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { useHiddenPosts } from "@/features/community/hidden-posts";
import { PostMemberModeration } from "@/features/admin/post-member-moderation";
import { canSanction, type ModerationScope } from "@/features/community/use-gallery-role";
import { PostUserActionsMenu } from "@/features/posts/post-user-actions-menu";
import { FigmaSheet } from "@/components/figma-sheet";
import { ReportReasons } from "@/features/comments/report-reasons";
import { PostActions } from "@/features/posts/post-actions";
import { usePostInteractions } from "@/features/posts/use-post-interactions";
import { useEffect, useRef, useState } from "react";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
import { deletePost, fetchPost, moderateGalleryContent, updatePost } from "@/lib/api/community";
import type { PostDetailResponse, PostListItem } from "@/lib/api/contracts";
import { useCurrentUserId } from "@/features/auth/use-current-user";
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
  const [reportOpen, setReportOpen] = useState(false);
  const detailKey = `${currentUserId}:${post.postId}`;
  const [detailResult, setDetailResult] = useState<{ key: string; detail: PostDetailResponse | null } | null>(null);
  const currentDetail = detailResult?.key === detailKey ? detailResult : null;
  const interactions = usePostInteractions(post.postId, currentDetail?.detail ?? null);
  const detailStatus = currentDetail ? "unavailable" : "loading";
  const saveStatus = currentUserId === null || interactions.bookmarked !== undefined
    ? "ready"
    : detailStatus;
  const voteStatus = currentUserId === null || interactions.reaction ? "ready" : detailStatus;
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(post.imageUrl);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const moderating = canModerate && !owner;

  useEffect(() => {
    const article = articleRef.current;
    if (currentUserId === null || !article) return;
    const controller = new AbortController();
    const { signal } = controller;
    function loadDetail() {
      void fetchPost(post.postId, signal)
        .then((detail) => {
          if (signal.aborted) return;
          setDetailResult({ key: detailKey, detail });
          setPreview(detail.content);
          setImageUrl(detail.imageUrl);
        })
        .catch((error) => {
          if (!signal.aborted) {
            setDetailResult({ key: detailKey, detail: null });
            setError(postError(error));
          }
        });
    }
    if (typeof IntersectionObserver === "undefined") {
      loadDetail();
      return () => controller.abort();
    }
    const observer = new IntersectionObserver((entries) => {
      if (signal.aborted || !entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      loadDetail();
    }, { rootMargin: "300px 0px" });
    observer.observe(article);
    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, [currentUserId, detailKey, post.postId, post.imageUrl]);

  async function startEdit() {
    setMenuOpen(false);
    setError(null);
    setSubmitting(true);
    try {
      const detail = await fetchPost(post.postId);
      setTitle(detail.title);
      setContent(detail.content);
      setEditing(true);
    } catch (error) {
      setError(postError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveEdit() {
    if (!title.trim() || !content.trim()) {
      setError("제목과 내용을 모두 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await updatePost(post.postId, title, content);
      setPreview(content);
      setEditing(false);
      onChanged();
    } catch (error) {
      setError(postError(error));
    } finally {
      setSubmitting(false);
    }
  }

  async function remove() {
    setMenuOpen(false);
    if (moderating && !moderationReason.trim()) {
      setError("운영 삭제 사유를 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      if (moderating && moderation)
        await moderateGalleryContent(moderation.galleryId, "posts", post.postId, moderationReason.trim());
      else await deletePost(post.postId);
      onChanged();
    } catch (error) {
      setError(postError(error));
      setSubmitting(false);
      setConfirmDelete(false);
    }
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
            setReportOpen(true);
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
      <h2>
        <button
          className={communityStyles.postRead}
          disabled={submitting}
          onClick={() => onComments(post.postId)}
        >
          {post.title}
        </button>
      </h2>
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
