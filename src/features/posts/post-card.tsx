import { communityStyles } from "@/styles/community.styles";
import { buttonVariants } from "@/styles/variants";
import { useHiddenPosts } from "@/features/community/hidden-posts";
import {
  PostMemberModeration,
  type PostModerationCommunity,
} from "@/features/admin/post-member-moderation";
import { canManageCommunityMember } from "@/features/admin/permissions";
import { PostUserActionsMenu } from "@/components/app/dialog";
import { FigmaSheet } from "@/components/app/figma-sheet";
import { ReportReasons } from "@/components/app/report-reasons";
import { PostActions } from "@/components/app/post-actions";
import { useSavedItems } from "@/features/saved/saved-store";
import { useEffect, useRef, useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import { deletePost, fetchPost, updatePost } from "@/lib/api/community";
import type { PostListItem } from "@/lib/api/contracts";
import { getAccessToken, getCurrentUserId } from "@/lib/api/client";
import { postError, relativeTime } from "@/features/posts/post-utils";

export function CommunityPost({
  post,
  onChanged,
  onComments,
  onProfile,
  onModerateDelete,
  moderationCommunity,
  postGalleryId,
}: {
  postGalleryId?: number;
  moderationCommunity?: PostModerationCommunity;
  onModerateDelete?: (postId: number) => Promise<void>;
  post: PostListItem;
  onChanged: () => void;
  onComments: (postId: number) => void;
  onProfile?: (userId: number) => void;
}) {
  const currentUserId = getCurrentUserId();
  const owner = currentUserId === post.writer.userId;
  const canModerateMember = Boolean(
    moderationCommunity &&
    moderationCommunity.galleryId === postGalleryId &&
    canManageCommunityMember(moderationCommunity, currentUserId, post.writer.userId),
  );
  const [memberAction, setMemberAction] = useState<"suspend" | "expel" | null>(null);
  const [moderationNotice, setModerationNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const optionButton = useRef<HTMLButtonElement>(null);
  const hiddenPosts = useHiddenPosts();
  const [reportOpen, setReportOpen] = useState(false);
  const [vote, setVote] = useState<"like" | "dislike" | null>(null);
  const savedItems = useSavedItems();
  const saved = savedItems.has("post", post.postId);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(post.imageUrl);

  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) return;
    let cancelled = false;
    fetchPost(post.postId)
      .then((detail) => {
        if (!cancelled) {
          setPreview(detail.content);
          setImageUrl(detail.imageUrl);
        }
      })
      .catch((error) => {
        if (!cancelled) setError(postError(error));
      });
    return () => {
      cancelled = true;
    };
  }, [post.postId, post.imageUrl]);

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
    setSubmitting(true);
    setError(null);
    try {
      if (onModerateDelete) await onModerateDelete(post.postId);
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
      <article className={communityStyles.communityPost} data-post-id={post.postId}>
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
    <article className={communityStyles.communityPost} data-post-id={post.postId}>
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
      {menuOpen && (!owner || onModerateDelete) && (
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
            onModerateDelete
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
      {memberAction && moderationCommunity && (
        <PostMemberModeration
          community={moderationCommunity}
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
          <ReportReasons />
        </FigmaSheet>
      )}
      {menuOpen && owner && !onModerateDelete && (
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
      {preview !== "" && (
        <button
          className={communityStyles.postPreview}
          onClick={() => onComments(post.postId)}
          disabled={submitting}
        >
          {preview ?? "로그인 후 게시글 내용을 확인할 수 있어요."}
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
          <p>이 게시글을 삭제할까요?</p>
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
            disabled={submitting}
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
        likeCount={post.likeCount}
        commentCount={post.commentCount}
        vote={vote}
        onVote={(next) => setVote((current) => (current === next ? null : next))}
        onComments={() => onComments(post.postId)}
        saved={saved}
        onSave={() => {
          try {
            savedItems.toggle({
              id: post.postId,
              kind: "post",
              title: preview ?? post.title,
              author: post.writer.nickname,
              imageUrl: post.imageUrl,
            });
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "저장하지 못했습니다.");
          }
        }}
      />
    </article>
  );
}
