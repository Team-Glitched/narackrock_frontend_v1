import { reactionControlVariants } from "@/styles/variants";
import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";
import { IconSlot } from "./shared";

const actionControl = reactionControlVariants();

export type PostVote = "like" | "dislike" | null;

/** The same reaction controls for community posts and open-source posts. */
export function PostActions({
  likeCount,
  commentCount,
  vote,
  onVote,
  onComments,
  saved = false,
  onSave,
  compact = false,
  readOnly = false,
  dislikeCount = 0,
}: {
  likeCount: number;
  commentCount: number;
  vote: PostVote;
  onVote: (vote: Exclude<PostVote, null>) => void;
  onComments: () => void;
  saved?: boolean;
  onSave?: () => void;
  compact?: boolean;
  readOnly?: boolean;
  dislikeCount?: number;
}) {
  if (readOnly)
    return (
      <div className={communityStyles.postReadonlyStats} aria-label="게시글 통계">
        <span>
          <IconSlot name="like.svg" kind="mini" />
          {likeCount}
        </span>
        <span>
          <IconSlot name="mini-dislike.svg" kind="mini" />
          {dislikeCount}
        </span>
        <span>
          <IconSlot name="mini-comment.svg" kind="mini" />
          {commentCount}
        </span>
      </div>
    );
  return (
    <div
      className={cn(
        cn(
          communityStyles.postActions,
          "mt-2 flex h-[26px] w-full items-center gap-[6px] font-sans text-body leading-[22px] font-medium text-app-fg",
        ),
        compact && "m-0 w-auto flex-none",
      )}
    >
      <div
        className={
          "flex h-[26px] flex-none items-center gap-[10px] rounded-[20px] border-0 bg-app-surface px-[10px]"
        }
        role="group"
        aria-label="게시글 반응"
      >
        <button
          className={reactionControlVariants({ kind: "vote" })}
          onClick={() => onVote("like")}
          aria-label="좋아요"
          aria-pressed={vote === "like"}
        >
          <IconSlot name={`v3-post-like-${vote === "like" ? "on" : "off"}.svg`} kind="post" />
          {likeCount + Number(vote === "like")}
        </button>
        <span className={"h-[22px] w-px flex-none bg-app-fg"} aria-hidden="true" />
        <button
          className={reactionControlVariants({ kind: "vote" })}
          onClick={() => onVote("dislike")}
          aria-label="싫어요"
          aria-pressed={vote === "dislike"}
        >
          <IconSlot name={`v3-post-dislike-${vote === "dislike" ? "on" : "off"}.svg`} kind="post" />
        </button>
      </div>
      <button
        className={actionControl}
        onClick={onComments}
        aria-label={`댓글 ${commentCount}개 보기`}
      >
        <IconSlot name="post-comment.svg" kind="post" />
        {commentCount}
      </button>
      {!compact && (
        <>
          <span className={"min-w-0 flex-1"} />
          <button
            className={reactionControlVariants({ kind: "icon" })}
            disabled
            aria-label="공유 기능 준비 중"
          >
            <IconSlot name="post-share.svg" kind="post" />
          </button>
          <button
            className={reactionControlVariants({ kind: "icon" })}
            aria-label="저장"
            aria-pressed={saved}
            disabled={!onSave}
            onClick={onSave}
          >
            <IconSlot name={`v3-post-save-${saved ? "on" : "off"}.svg`} kind="post-save" />
          </button>
        </>
      )}
    </div>
  );
}
