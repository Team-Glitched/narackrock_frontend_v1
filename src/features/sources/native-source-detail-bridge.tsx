import { partLabel } from "@/features/composition/instrument-parts";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import { useNativeComments } from "@/features/comments/use-native-comments";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import type { NativeHeader, NativeSourceDetail } from "@/lib/native-screens";
import { isNativeCommentAction } from "@/lib/native-screens/comments";
import {
  idlePlayback,
  SourcePlayerReporter,
  sourcePlayerLabel,
  useNativePlayers,
} from "./native-source-players";
import { sourceUsage, type SourceDetailState } from "./source-screens";

/** The web sample page's Header: back, notifications, search, account. */
const header: NativeHeader = { left: "back", actions: ["notifications", "chat", "search", "account"] };

/** The detail's player key. */
const player = "detail";

/**
 * In the app the sample page (OpensourceDetailScreen) is drawn natively
 * (native/screens/sources/detail.tsx); its audio stays in this page.
 */
export function NativeSourceDetailBridge({
  detail,
  focusComments,
  onProfile,
  onBack,
  onSearch,
}: {
  detail: SourceDetailState;
  /** Opened as /sources/:id/comments. */
  focusComments: boolean;
  onProfile: (userId: number) => void;
  onBack: () => void;
  onSearch: () => void;
}) {
  const { source, save } = detail;
  const { requestLogin } = useLoginPrompt();
  const comments = useNativeComments(detail.comments, { onProfile, focus: detail.focus });
  const { players, report, control } = useNativePlayers();
  const model: NativeSourceDetail =
    detail.userId === null
      ? { state: "signed-out" }
      : detail.loading
        ? { state: "loading" }
        : !source
          ? { state: "error", message: detail.error }
          : {
              state: "ready",
              source: {
                openSourceId: source.openSourceId,
                title: source.title,
                instrumentLabel: source.instrument ? partLabel(source.instrument) : null,
                thumbnailUrl: source.thumbnailUrl,
                usage: source.usageCount != null ? sourceUsage(source.usageCount) : null,
                description: source.description ?? "",
                writer: {
                  userId: source.writer.userId,
                  nickname: source.writer.nickname,
                  profileImageUrl: source.writer.profileImageUrl,
                },
                likeCount: source.likeCount,
                dislikeCount: source.dislikeCount,
                commentCount: source.commentCount,
                vote: source.isLiked ? "like" : source.isDisliked ? "dislike" : null,
                saved: save.saved,
                canPreview: source.canPreview,
              },
              canReport: detail.userId !== null && detail.userId !== source.writer.userId,
              saveBusy: save.busy,
              saveError: save.error || null,
              busy: detail.busy,
              notice: detail.notice || null,
              player: source.canPreview
                ? (players[player] ?? idlePlayback(sourcePlayerLabel, source.durationMs))
                : null,
              comments: comments.model,
              openComments: focusComments,
            };
  const node = useNativeScreen("source-detail", model, {
    header,
    onBack,
    onSearch,
    onAction: (action) => {
      if (isNativeCommentAction(action)) return comments.act(action);
      switch (action.type) {
        case "source-retry":
          return detail.retry();
        case "source-vote":
          return detail.vote(action.vote);
        case "source-save":
          return save.toggle();
        case "source-share":
          return detail.share();
        case "source-comments":
          return detail.focusComments();
        case "source-profile":
          return onProfile(action.userId);
        case "source-play":
          return control(player)?.toggle();
        case "source-seek":
          return control(player)?.seek(action.ms);
        case "source-mute":
          return control(player)?.toggleMute();
        case "sign-in":
          return requestLogin();
      }
    },
  });
  return (
    <>
      {node}
      {comments.node}
      {source?.canPreview && (
        <SourcePlayerReporter
          key={source.openSourceId}
          id={player}
          sourceId={source.openSourceId}
          durationMs={source.durationMs}
          report={report}
        />
      )}
    </>
  );
}

/** A malformed sample address ("올바르지 않은 페이지 주소입니다."). */
export function NativeInvalidSourceBridge({
  onBack,
  onSearch,
}: {
  onBack: () => void;
  onSearch: () => void;
}) {
  return useNativeScreen("source-detail", { state: "invalid" }, { header, onBack, onSearch });
}
