export type SongDto = { id: string; title: string; artistName: string; coverUrl: string | null };
export type PostDto = { id: string; authorName: string; title: string; body: string; imageUrl: string | null; likes: number; comments: number };
export type UserDto = { id: string; displayName: string; avatarUrl: string | null };

export type ApiEnvelope<T> = { success: boolean; message: string; data: T };

export type ShortItemDto = {
  shortId: number;
  projectId: number | null;
  title: string;
  mediaUrl: string | null;
  albumImageUrl: string | null;
  completionStatus: "IN_PROGRESS" | "COMPLETED";
  viewCount: number;
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  contributionCount: number;
  isLiked: boolean;
  isDisliked: boolean;
  isBookmarked: boolean;
  author: { userId: number; nickname: string; profileImageUrl: string | null };
  participants: { userId: number; nickname: string; role: string }[];
  createdAt: string;
};

export type ShortsPageDto = {
  items: ShortItemDto[];
  page: { nextCursor: number | null; hasMore: boolean; size: number };
};
