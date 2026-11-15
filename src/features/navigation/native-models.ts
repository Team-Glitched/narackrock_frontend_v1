import { relativeTime } from "@/features/posts/post-utils";
import type { PostListItem, SongCardDto } from "@/lib/api/contracts";
import type { NativePost, NativeSong } from "@/lib/native-screens";

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
