import { LoaderCircle } from "lucide-react";
import { iconSlotVariants, reactionControlVariants } from "@/styles/variants";
import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";
import { IconSlot } from "@/components/icon-slot";

const actionControl = reactionControlVariants();

export type PostVote = "like" | "dislike" | null;

/**
 * The same reaction controls for community posts, shorts and open sources. Counts and `vote` are the
 * server's values; the controls never add local increments. `busy` blocks repeat clicks while a change is sent.
 */
export function PostActions({
  likeCount,
  commentCount,
  vote,
  onVote,
  onComments,
  saved = false,
  saveStatus = "ready",
  onSave,
  onShare,
  busy = false,
  compact = false,
  readOnly = false,
  dislikeCount,
}: {
  likeCount: number;
  commentCount: number;
  vote: PostVote;
  onVote: (vote: Exclude<PostVote, null>) => void;
  onComments: () => void;
  saved?: boolean;
  saveStatus?: "ready" | "loading" | "unavailable";
  onSave?: () => void;
  onShare?: () => void;
  busy?: boolean;
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
          disabled={busy}
          aria-label="좋아요"
          aria-pressed={vote === "like"}
        >
          <IconSlot name={`v3-post-like-${vote === "like" ? "on" : "off"}.svg`} kind="post" />
          {likeCount}
        </button>
        <span className={"h-[22px] w-px flex-none bg-app-fg"} aria-hidden="true" />
        <button
          className={reactionControlVariants({ kind: "vote" })}
          onClick={() => onVote("dislike")}
          disabled={busy}
          aria-label={dislikeCount == null ? "싫어요" : `싫어요 ${dislikeCount}개`}
          aria-pressed={vote === "dislike"}
        >
          <IconSlot name={`v3-post-dislike-${vote === "dislike" ? "on" : "off"}.svg`} kind="post" />
          <span aria-hidden="true" className="min-w-[1ch] text-center tabular-nums">
            {dislikeCount ?? "‒"}
          </span>
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
            disabled={!onShare}
            onClick={onShare}
            aria-label={onShare ? "공유" : "공유할 수 없음"}
          >
            <IconSlot name="post-share.svg" kind="post" />
          </button>
          <button
            className={reactionControlVariants({ kind: "icon" })}
            aria-label={saveStatus === "loading" ? "저장 상태 확인 중" : saveStatus === "unavailable" ? "저장 상태를 불러오지 못했습니다" : "저장"}
            aria-pressed={saveStatus === "ready" ? saved : undefined}
            aria-busy={saveStatus === "loading"}
            disabled={!onSave || busy || saveStatus !== "ready"}
            onClick={onSave}
          >
            {saveStatus === "ready" ? (
              <IconSlot name={`v3-post-save-${saved ? "on" : "off"}.svg`} kind="post-save" />
            ) : (
              <span className={iconSlotVariants({ kind: "post-save" })} aria-hidden="true">
                {saveStatus === "loading" ? (
                  <LoaderCircle className="h-full w-3 motion-safe:animate-spin" />
                ) : "‒"}
              </span>
            )}
          </button>
        </>
      )}
    </div>
  );
}
