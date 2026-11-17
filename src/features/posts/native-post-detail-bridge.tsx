import { useNativeComments } from "@/features/comments/use-native-comments";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { emptyNativeComments, isNativeCommentAction } from "@/lib/native-screens/comments";
import type { NativeHeader, NativePostDetail } from "@/lib/native-screens";
import { time, type PostDetailState } from "./post-comments";

/** The web post page's Header: back, notifications, search, account. */
const header: NativeHeader = { left: "back", actions: ["notifications", "search", "account"] };

/** In the app the post page (PostCommentsScreen) is drawn natively (native/screens/post/post-detail.tsx). */
export function NativePostDetailBridge({
  detail,
  onProfile,
  onBack,
  onSearch,
}: {
  detail: PostDetailState;
  onProfile?: (userId: number) => void;
  onBack: () => void;
  onSearch: () => void;
}) {
  const { post, interactions } = detail;
  const comments = useNativeComments(detail.comments, { onProfile, focus: detail.focus });
  const model: NativePostDetail = {
    invalid: false,
    error: detail.error,
    retry: detail.error !== null && !post,
    notice: detail.moderationNotice || null,
    post: post && {
      postId: post.postId,
      title: post.title,
      content: post.content,
      imageUrl: post.imageUrl,
      writer: {
        userId: post.writer.userId,
        nickname: post.writer.nickname || "알 수 없는 사용자",
        profileImageUrl: post.writer.profileImageUrl,
      },
      community: post.gallery.name?.trim() || null,
      createdLabel: time(post.createdAt),
      likeCount: interactions.reaction?.likeCount ?? post.likeCount,
      dislikeCount: interactions.reaction?.dislikeCount ?? post.dislikeCount,
      commentCount: post.commentCount,
      vote: interactions.reaction?.isLiked
        ? "like"
        : interactions.reaction?.isDisliked
          ? "dislike"
          : null,
      saved: interactions.bookmarked ?? false,
    },
    busy: interactions.busy,
    interactionNotice: interactions.notice,
    menu: { moderate: detail.canModerate, sanction: detail.canModerateMember },
    confirmDelete: detail.confirmDelete,
    deleting: detail.deleting,
    comments: comments.model,
  };
  const node = useNativeScreen("post-detail", model, {
    header,
    onBack,
    onSearch,
    onAction: (action) => {
      if (isNativeCommentAction(action)) return comments.act(action);
      switch (action.type) {
        case "post-retry":
          return detail.retry();
        case "post-vote":
          return interactions.vote(action.vote);
        case "post-save":
          return interactions.toggleBookmark();
        case "post-share":
          if (post) void interactions.share(post.title);
          return;
        case "post-comments":
          return detail.focusComments();
        case "post-report":
          return detail.report();
        case "post-hide":
          return detail.hide();
        case "post-delete-open":
          return detail.setConfirmDelete(true);
        case "post-delete-cancel":
          return detail.setConfirmDelete(false);
        case "post-delete":
          return detail.removePost(action.reason);
        case "post-sanction":
          return detail.sanction(action.action);
        case "open-profile":
          return onProfile?.(action.userId);
      }
    },
  });
  return (
    <>
      {node}
      {comments.node}
      {detail.dialogs}
      {interactions.shareDialog}
    </>
  );
}

/** A malformed post address ("올바르지 않은 페이지 주소입니다."). */
export function NativeInvalidPostBridge({
  onBack,
  onSearch,
}: {
  onBack: () => void;
  onSearch: () => void;
}) {
  return useNativeScreen(
    "post-detail",
    {
      invalid: true,
      error: null,
      retry: false,
      notice: null,
      post: null,
      busy: false,
      interactionNotice: null,
      menu: { moderate: false, sanction: false },
      confirmDelete: false,
      deleting: false,
      comments: emptyNativeComments,
    },
    { header, onBack, onSearch },
  );
}
