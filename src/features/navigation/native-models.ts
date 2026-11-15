import { useCurrentUserId } from "@/features/auth/use-current-user";
import { memberLabel, type Community } from "@/features/community/community-card";
import { useCommunityMembership } from "@/features/community/community-membership";
import { relativeTime } from "@/features/posts/post-utils";
import type { PostListItem, SongCardDto } from "@/lib/api/contracts";
import type { OpenSourceSummary } from "@/lib/api/open-sources";
import type { NativeCommunity, NativePost, NativeSong, NativeSourceRow } from "@/lib/native-screens";

/** Song card for native screens. */
export function nativeSong(song: SongCardDto): NativeSong {
  return {
    shortId: song.shortId,
    title: song.title,
    author: song.author.nickname,
    albumImageUrl: song.albumImageUrl,
    ownerId: song.author.userId,
  };
}

/** Post row for native screens; the excerpt follows the web's MiniPost. */
export function nativePost(post: PostListItem & { content?: string }): NativePost {
  return {
    postId: post.postId,
    title: post.title,
    excerpt: post.content || post.contentPreview || post.title,
    imageUrl: post.imageUrl,
    writer: { nickname: post.writer.nickname, profileImageUrl: post.writer.profileImageUrl },
    ownerId: post.writer.userId,
    createdLabel: relativeTime(post.createdAt),
    likeCount: post.likeCount,
    dislikeCount: post.dislikeCount ?? 0,
    commentCount: post.commentCount,
  };
}

export function nativeSourceRow(source: OpenSourceSummary): NativeSourceRow {
  return {
    openSourceId: source.openSourceId,
    title: source.title,
    author: source.writer.nickname,
    thumbnailUrl: source.thumbnailUrl,
  };
}

/** Maps communities to native cards with the web join button's state (CommunityJoinButton). */
export function useNativeCommunities() {
  const userId = useCurrentUserId();
  const membership = useCommunityMembership();
  return {
    card: (community: Community): NativeCommunity => ({
      galleryId: community.galleryId,
      name: community.name,
      description: community.description,
      imageUrl: community.imageUrl,
      memberLabel: memberLabel(community.memberCount),
      join:
        userId !== null && community.ownerId === userId
          ? "owner"
          : membership.loading
            ? "loading"
            : membership.loadFailed
              ? "failed"
              : membership.isJoined(community.id)
                ? "joined"
                : "join",
      joinPending: membership.isPending(community.id),
    }),
    toggle: membership.toggle,
  };
}
