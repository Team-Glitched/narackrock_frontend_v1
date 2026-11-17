import { useCallback, useEffect, useEffectEvent, useRef, useState, type ReactNode } from "react";
import { PostMemberModeration } from "@/features/admin/post-member-moderation";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { ReportReasons } from "@/features/comments/report-reasons";
import type { GalleryPosts } from "@/features/community/use-gallery-posts";
import type { ModerationScope } from "@/features/community/use-gallery-role";
import { useCommunityPostCard } from "@/features/posts/post-card";
import { relativeTime } from "@/features/posts/post-utils";
import { reportPost } from "@/lib/api/reports";
import type { PostListItem } from "@/lib/api/contracts";
import type {
  NativeFeed,
  NativeFeedAction,
  NativeFeedPost,
  NativeFeedPostMenuItem,
} from "@/lib/native-screens";

type CardAction = Extract<NativeFeedAction, { postId: number }>;

const feedActions: Record<NativeFeedAction["type"], true> = {
  "feed-retry": true,
  "feed-visible": true,
  "post-open": true,
  "post-profile": true,
  "post-vote": true,
  "post-save": true,
  "post-share": true,
  "post-menu": true,
  "post-edit-save": true,
  "post-edit-cancel": true,
  "post-delete-cancel": true,
  "post-delete": true,
};

export function isFeedAction(action: { type: string }): action is NativeFeedAction {
  return Object.hasOwn(feedActions, action.type);
}

/**
 * A feed of post cards for a native screen. Each headless source reuses the card's
 * state (`useCommunityPostCard`) and mounts only native report, sanction and share bridges.
 * Render `sources` and pass feed actions to `handle`.
 */
export function useNativeFeed({
  posts,
  moderation,
  texts,
  autoMore,
  endNotice,
  onComments,
  onProfile,
}: {
  posts: GalleryPosts;
  moderation: ModerationScope;
  texts: Pick<NativeFeed, "loadingText" | "errorText" | "emptyText">;
  autoMore: boolean;
  endNotice: boolean;
  onComments: (postId: number) => void;
  onProfile?: (userId: number) => void;
}): { feed: NativeFeed; handle: (action: NativeFeedAction) => void; sources: ReactNode } {
  const userId = useCurrentUserId();
  const [cards, setCards] = useState<Record<number, NativeFeedPost | null>>({});
  const handlers = useRef(new Map<number, (action: CardAction) => void>());
  // Posts the app reported on screen; their detail (reactions, saved state) is then requested, like the
  // web card's IntersectionObserver.
  const [seen, setSeen] = useState<ReadonlySet<number>>(() => new Set());

  const report = useCallback((postId: number, card: NativeFeedPost | null | undefined) => {
    setCards((current) => {
      if (card === undefined) {
        if (!(postId in current)) return current;
        const next = { ...current };
        delete next[postId];
        return next;
      }
      return { ...current, [postId]: card };
    });
  }, []);
  const register = useCallback((postId: number, handler: ((action: CardAction) => void) | null) => {
    if (handler) handlers.current.set(postId, handler);
    else handlers.current.delete(postId);
  }, []);

  const ready = posts.status === "ready" ? posts.posts : [];
  const items = ready.flatMap((post) => {
    const card = cards[post.postId];
    return card ? [card] : [];
  });
  const feed: NativeFeed = {
    // The cards report right after they mount; until then the list is not empty, only not drawn yet.
    status: ready.length > 0 && items.length === 0 ? "loading" : posts.status,
    ...texts,
    items,
    hasMore: posts.hasMore,
    appending: posts.appending,
    appendFailed: posts.appendFailed,
    autoMore,
    endNotice: endNotice && !posts.hasMore && ready.length > 0,
  };

  function handle(action: NativeFeedAction) {
    switch (action.type) {
      case "feed-retry":
        return posts.refetch();
      case "feed-visible":
        return setSeen((current) =>
          action.postIds.every((id) => current.has(id))
            ? current
            : new Set([...current, ...action.postIds]),
        );
      case "post-open":
        return onComments(action.postId);
      case "post-profile":
        return onProfile?.(action.userId);
      default:
        return handlers.current.get(action.postId)?.(action);
    }
  }

  const sources = ready.map((post) => (
    <FeedPostSource
      key={`${userId}:${post.postId}`}
      post={post}
      moderation={moderation}
      currentUserId={userId}
      nearViewport={seen.has(post.postId)}
      onChanged={posts.refetch}
      onCard={report}
      onRegister={register}
    />
  ));
  return { feed, handle, sources };
}

function FeedPostSource({
  post,
  moderation,
  currentUserId,
  nearViewport,
  onChanged,
  onCard,
  onRegister,
}: {
  post: PostListItem;
  moderation: ModerationScope;
  currentUserId: number | null;
  nearViewport: boolean;
  onChanged: () => void;
  onCard: (postId: number, card: NativeFeedPost | null | undefined) => void;
  onRegister: (postId: number, handler: ((action: CardAction) => void) | null) => void;
}) {
  const card = useCommunityPostCard({ post, onChanged, moderation, currentUserId, nearViewport });
  const { interactions } = card;
  const menu: NativeFeedPostMenuItem[] = card.owner
    ? ["edit", "delete"]
    : [
        "report",
        "hide",
        ...(card.canModerate ? (["moderate-delete"] as const) : []),
        ...(card.canModerateMember ? (["suspend", "expel"] as const) : []),
      ];
  const model: NativeFeedPost | null = card.hidden
    ? null
    : {
        postId: post.postId,
        title: post.title,
        preview: card.preview || null,
        imageUrl: card.imageUrl,
        writer: {
          userId: post.writer.userId,
          nickname: post.writer.nickname,
          profileImageUrl: post.writer.profileImageUrl,
        },
        createdLabel: relativeTime(post.createdAt),
        community: post.gallery?.name?.trim() || null,
        menu,
        likeCount: interactions.reaction?.likeCount ?? post.likeCount,
        dislikeCount: interactions.reaction?.dislikeCount ?? null,
        commentCount: post.commentCount,
        vote: interactions.reaction?.isLiked
          ? "like"
          : interactions.reaction?.isDisliked
            ? "dislike"
            : null,
        voteStatus: card.voteStatus,
        saved: interactions.bookmarked ?? false,
        saveStatus: card.saveStatus,
        busy: interactions.busy,
        submitting: card.submitting,
        notice: interactions.notice,
        error: card.error,
        moderationNotice: card.moderationNotice || null,
        editing: card.editing ? { title: card.title, content: card.content } : null,
        confirmDelete: card.confirmDelete ? { moderating: card.moderating } : null,
      };
  const snapshot = JSON.stringify(model);
  useEffect(
    () => onCard(post.postId, JSON.parse(snapshot) as NativeFeedPost | null),
    [onCard, post.postId, snapshot],
  );
  useEffect(() => () => onCard(post.postId, undefined), [onCard, post.postId]);

  const act = useEffectEvent((action: CardAction) => {
    switch (action.type) {
      case "post-vote":
        return interactions.vote(action.vote);
      case "post-save":
        return interactions.toggleBookmark();
      case "post-share":
        return void interactions.share(post.title);
      case "post-menu":
        switch (action.item) {
          case "report":
            return card.report();
          case "hide":
            return card.hide();
          case "edit":
            return void card.startEdit();
          case "delete":
          case "moderate-delete":
            return card.setConfirmDelete(true);
          case "suspend":
          case "expel":
            return card.setMemberAction(action.item);
        }
        return;
      case "post-edit-save":
        // The app keeps the text while typing; the web form state follows it for the save.
        card.setTitle(action.title);
        card.setContent(action.content);
        return card.saveEdit({ title: action.title, content: action.content });
      case "post-edit-cancel":
        return card.setEditing(false);
      case "post-delete-cancel":
        return card.setConfirmDelete(false);
      case "post-delete":
        return card.remove(action.reason);
    }
  });
  useEffect(() => {
    onRegister(post.postId, (action) => act(action));
    return () => onRegister(post.postId, null);
  }, [onRegister, post.postId]);

  return (
    <>
      {interactions.shareDialog}
      {card.memberAction && (
        <PostMemberModeration
          community={moderation}
          member={post.writer}
          action={card.memberAction}
          onClose={() => card.setMemberAction(null)}
          onDone={(message) => {
            card.setMemberAction(null);
            card.setModerationNotice(message);
          }}
        />
      )}
      {card.reportOpen && (
        <ReportReasons
          onSubmit={(reason, description) => reportPost(post.postId, reason, description)}
          onDone={() => card.setReportOpen(false)}
        />
      )}
    </>
  );
}
