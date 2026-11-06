import { useMemo } from "react";
import { FigmaSheet } from "@/components/figma-sheet";
import { CommonComments } from "@/features/comments/common-comments";
import type { CommentAdapter, CommentItem } from "@/features/comments/comment-model";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { relativeTime } from "@/features/posts/post-utils";
import { reportShortComment } from "@/lib/api/reports";
import {
  createShortComment,
  deleteShortComment,
  dislikeShortComment,
  getShortComments,
  likeShortComment,
  updateShortComment,
  type ShortComment,
} from "@/lib/api/shorts";

const toItem = (comment: ShortComment): CommentItem => ({
  id: comment.commentId,
  parentId: comment.parentCommentId,
  userId: comment.writer.userId,
  author: comment.writer.nickname ?? "알 수 없는 사용자",
  avatarUrl: comment.writer.profileImageUrl,
  text: comment.content,
  time: relativeTime(comment.createdAt),
  replyCount: comment.replyCount,
  likes: comment.likeCount,
  dislikes: comment.dislikeCount,
  isLiked: comment.isLiked,
  isDisliked: comment.isDisliked,
});

/** Short comments: the server returns every comment at once, so pages are the parent-filtered full list. */
export function AbyssComments({
  open,
  onClose,
  shortId,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  shortId: number;
  onChanged: () => void;
}) {
  const userId = useCurrentUserId();
  const adapter = useMemo<CommentAdapter>(
    () => ({
      kind: "shorts",
      targetId: shortId,
      async load(parentId, _page, signal) {
        const items = (await getShortComments(shortId, signal)).comments
          .filter((comment) => comment.parentCommentId === parentId)
          .map(toItem);
        return { items, total: items.length, page: 0 };
      },
      create: (text, parentId) => createShortComment(shortId, text, parentId),
      update: (id, text) => updateShortComment(shortId, id, text),
      remove: (id) => deleteShortComment(shortId, id),
      async react(id, kind) {
        await (kind === "like" ? likeShortComment(shortId, id) : dislikeShortComment(shortId, id));
        // Each toggle reports only its own side; re-read so both like and dislike reflect the server.
        const comment = (await getShortComments(shortId)).comments.find((item) => item.commentId === id);
        if (!comment) throw new Error("댓글을 찾을 수 없습니다.");
        return {
          isLiked: comment.isLiked,
          isDisliked: comment.isDisliked,
          likeCount: comment.likeCount,
          dislikeCount: comment.dislikeCount,
        };
      },
      report: (id, reason, description) => reportShortComment(shortId, id, reason, description),
    }),
    [shortId],
  );
  if (!open) return null;
  return (
    <FigmaSheet title="댓글" onClose={onClose}>
      <CommonComments key={userId} adapter={adapter} currentUserId={userId} onChanged={onChanged} />
    </FigmaSheet>
  );
}
