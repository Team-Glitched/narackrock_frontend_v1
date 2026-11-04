import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/styles/variants";
import { useEffect, useMemo, useRef, useState } from "react";
import { canSanction, useGalleryRole, type ModerationScope } from "@/features/community/use-gallery-role";
import { PostMemberModeration } from "@/features/admin/post-member-moderation";
import { useHiddenPosts } from "@/features/community/hidden-posts";
import { PostUserActionsMenu } from "@/features/posts/post-user-actions-menu";
import { FigmaSheet } from "@/components/ui/figma-sheet";
import { ReportReasons } from "@/features/comments/report-reasons";
import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { Asset } from "@/components/ui/asset";
import { Avatar } from "@/components/ui/avatar";
import {
  createPostComment,
  deletePostComment,
  fetchPost,
  fetchPostComments,
  recordPostView,
  updatePostComment,
  reactToPostComment,
  moderateGalleryContent,
} from "@/lib/api/community";
import { ApiError, getCurrentUserId } from "@/lib/api/client";
import { CommonComments } from "@/features/comments/common-comments";
import type { CommentAdapter } from "@/features/comments/comment-model";
import type { PostDetailResponse } from "@/lib/api/contracts";
import { reportPost, reportPostComment } from "@/lib/api/reports";
import { PostActions } from "@/features/posts/post-actions";
import { usePostInteractions } from "@/features/posts/use-post-interactions";

function errorMessage(error: unknown, forbidden = "현재 계정은 댓글을 작성할 수 없습니다.") {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return "로그인이 필요하거나 만료되었습니다. 로그인 후 다시 시도해주세요.";
    if (error.status === 403) return forbidden;
    if (error.status === 404) return "게시글 또는 댓글이 삭제되었거나 존재하지 않습니다.";
    if (error.status === 400) return "댓글 내용과 입력값을 확인해주세요.";
  }
  return "불러오지 못했습니다. 잠시 후 다시 시도해주세요.";
}

function time(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : formatDistanceToNow(date, { addSuffix: true, locale: ko });
}
export function PostCommentsScreen({
  postId,
  onProfile,
  onHidden,
}: {
  postId: number;
  onProfile?: (userId: number) => void;
  onHidden: () => void;
}) {
  const hiddenPosts = useHiddenPosts();
  const [memberAction, setMemberAction] = useState<"suspend" | "expel" | null>(null);
  const [moderationNotice, setModerationNotice] = useState("");
  const [post, setPost] = useState<PostDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const role = useGalleryRole(post?.gallery.galleryId ?? null);
  const postGalleryId = post?.gallery.galleryId ?? null;
  const roleCanManage = role?.canManage === true;
  const moderationGalleryId = roleCanManage ? postGalleryId : null;
  const scope: ModerationScope | undefined =
    postGalleryId !== null && role ? { galleryId: postGalleryId, canManage: roleCanManage } : undefined;
  const canModerate = roleCanManage;
  const adapter = useMemo<CommentAdapter>(
    () => ({
      async load(parentId, page) {
        const result = await fetchPostComments(postId, parentId, page);
        return {
          page: result.page,
          total: result.totalCount,
          items: result.comments.map((item) => ({
            id: item.commentId,
            parentId: item.parentCommentId,
            userId: item.writer.userId,
            author: item.writer.nickname ?? "알 수 없는 사용자",
            avatarUrl: item.writer.profileImageUrl,
            text: item.content,
            time: time(item.createdAt),
            replyCount: item.replyCount,
            likes: item.likeCount,
            dislikes: item.dislikeCount,
            isLiked: item.isLiked,
            isDisliked: item.isDisliked,
          })),
        };
      },
      create: (text, parentId) => createPostComment(postId, text, parentId),
      update: updatePostComment,
      remove: deletePostComment,
      react: reactToPostComment,
      report: reportPostComment,
      ...(moderationGalleryId !== null
        ? { moderate: (id: number, reason: string) => moderateGalleryContent(moderationGalleryId, "comments", id, reason) }
        : {}),
    }),
    [postId, moderationGalleryId],
  );
  useEffect(() => {
    let cancelled = false;
    fetchPost(postId)
      .then((data) => {
        if (!cancelled) {
          setPost(data);
          setError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) setError(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, [postId, revision]);

  // 조회수는 **본문을 실제로 띄운 뒤에만** 기록한다.
  //
  // 화면에 들어오자마자 기록하면 상세 조회가 실패한 경우까지 집계된다. 이 화면은 인증이
  // 필수라(비로그인은 401) 로그인 전에는 본문이 뜨지 않는데, 그때도 조회수가 오르는 것을
  // 실제로 확인했다. 읽지 못한 글은 읽은 것이 아니다.
  //
  // revision(댓글 등록 후 재조회)에는 의존하지 않는다 - 같은 글을 계속 보고 있을 뿐이다.
  const loadedPostId = post?.postId;
  useEffect(() => {
    if (loadedPostId !== postId) return;
    // 조회수는 본문을 읽는 데 곁다리다. 결과를 쓰지 않고 실패해도 화면에 에러를 띄우지 않는다.
    void recordPostView(postId).catch(() => {});
  }, [postId, loadedPostId]);

  const [menu, setMenu] = useState(false);
  const optionButton = useRef<HTMLButtonElement>(null);
  const [report, setReport] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [moderationReason, setModerationReason] = useState("");
  const canModerateMember = post ? canSanction(scope, getCurrentUserId(), post.writer.userId) : false;
  async function removePost() {
    if (!canModerate || !scope || !moderationReason.trim()) return;
    setDeleting(true);
    try {
      await moderateGalleryContent(scope.galleryId, "posts", postId, moderationReason.trim());
      onHidden();
    } catch (cause) {
      setError(errorMessage(cause, "이 게시글을 삭제할 권한이 없습니다."));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }
  const [focus, setFocus] = useState(0);
  const interactions = usePostInteractions(postId, post);
  return (
    <div className={cn(communityStyles.commentsScreen, communityStyles.communityView)}>
      <CommonComments
        canWrite={post !== null && !deleting}
        adapter={adapter}
        currentUserId={getCurrentUserId()}
        onProfile={onProfile}
        onCreated={() => setRevision((value) => value + 1)}
        focus={focus}
        header={
          <>
            {error && (
              <div role="alert">
                <p>{error}</p>
                {!post && (
                  <button
                    className={buttonVariants({
                      tone: "secondary",
                      size: "compact",
                    })}
                    onClick={() => {
                      setError(null);
                      setRevision((value) => value + 1);
                    }}
                  >
                    다시 시도
                  </button>
                )}
              </div>
            )}
            {!post && !error && <p role="status">게시글을 불러오는 중...</p>}
            {post && scope && memberAction && (
              <PostMemberModeration
                community={scope}
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
            {post && (
              <>
                <article
                  className={cn(communityStyles.communityPost, communityStyles.commentsPost)}
                >
                  <div className={communityStyles.communityAuthor}>
                    <button
                      className={communityStyles.postAuthorLink}
                      aria-label={`${post.writer.nickname} 프로필`}
                      onClick={() => onProfile?.(post.writer.userId)}
                    >
                      <Avatar src={post.writer.profileImageUrl} />
                      <strong>{post.writer.nickname || "알 수 없는 사용자"}</strong>
                    </button>
                    <span>• {time(post.createdAt)}</span>
                    <button
                      ref={optionButton}
                      aria-label="게시글 더보기"
                      aria-expanded={menu}
                      onClick={() => setMenu((value) => !value)}
                    >
                      <Asset name="post-more.svg" />
                    </button>
                  </div>
                  {menu && (
                    <PostUserActionsMenu
                      onSuspendMember={
                        canModerateMember
                          ? () => {
                              setMenu(false);
                              setMemberAction("suspend");
                            }
                          : undefined
                      }
                      onExpelMember={
                        canModerateMember
                          ? () => {
                              setMenu(false);
                              setMemberAction("expel");
                            }
                          : undefined
                      }
                      anchorRef={optionButton}
                      onModerateDelete={
                        canModerate
                          ? () => {
                              setMenu(false);
                              setConfirmDelete(true);
                            }
                          : undefined
                      }
                      onClose={() => setMenu(false)}
                      onReport={() => {
                        setMenu(false);
                        setReport(true);
                      }}
                      onHide={() => {
                        hiddenPosts.hide(postId);
                        onHidden();
                      }}
                    />
                  )}
                  {confirmDelete && (
                    <div
                      className={communityStyles.postDeleteConfirm}
                      role="group"
                      aria-label="게시글 삭제 확인"
                    >
                      <p>운영자 권한으로 이 게시글을 삭제할까요?</p>
                      <input
                        aria-label="운영 삭제 사유"
                        placeholder="삭제 사유"
                        maxLength={500}
                        value={moderationReason}
                        onChange={(event) => setModerationReason(event.target.value)}
                      />
                      <button
                        className={buttonVariants({
                          tone: "secondary",
                        })}
                        disabled={deleting}
                        onClick={() => setConfirmDelete(false)}
                      >
                        취소
                      </button>
                      <button
                        className={buttonVariants({
                          tone: "primary",
                        })}
                        disabled={deleting || !moderationReason.trim()}
                        onClick={removePost}
                      >
                        {deleting ? "삭제 중..." : "삭제 확인"}
                      </button>
                    </div>
                  )}
                  <h2>{post.title}</h2>
                  {post.content && (
                    <p className={communityStyles.commentsPostContent}>{post.content}</p>
                  )}
                  {post.imageUrl && (
                    <img
                      className={communityStyles.communityImage}
                      src={post.imageUrl}
                      alt="게시글 첨부 이미지"
                      width={350}
                      height={262}
                    />
                  )}
                  <PostActions
                    likeCount={interactions.reaction?.likeCount ?? post.likeCount}
                    dislikeCount={interactions.reaction?.dislikeCount ?? post.dislikeCount}
                    commentCount={post.commentCount}
                    vote={interactions.reaction?.isLiked ? "like" : interactions.reaction?.isDisliked ? "dislike" : null}
                    busy={interactions.busy}
                    onVote={(kind) => void interactions.vote(kind)}
                    onComments={() => setFocus((value) => value + 1)}
                    saved={interactions.bookmarked}
                    onSave={() => void interactions.toggleBookmark()}
                    onShare={() => void interactions.share(post.title)}
                  />
                  {interactions.notice && <p role="status">{interactions.notice}</p>}
                </article>
                <div className={communityStyles.nrPostCommentDivider} />
              </>
            )}
          </>
        }
      />
      {report && (
        <FigmaSheet title="신고" onClose={() => setReport(false)}>
          <ReportReasons
            onSubmit={(reason, description) => reportPost(postId, reason, description)}
            onDone={() => setReport(false)}
          />
        </FigmaSheet>
      )}
    </div>
  );
}
