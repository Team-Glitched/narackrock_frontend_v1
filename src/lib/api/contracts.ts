export type SongDto = { id: string; title: string; artistName: string; coverUrl: string | null };
export type UserDto = { id: string; displayName: string; avatarUrl: string | null };

export type ApiResponse<T> = { success: boolean; message: string; errorCode?: string; data: T };
export type ApiEnvelope<T> = ApiResponse<T>;

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

export type PostWriter = { userId: number; nickname: string; profileImageUrl: string | null };

export type PostSort = "LATEST" | "POPULAR" | "OLDEST";

export type PostListItem = { postId: number; writer: PostWriter; title: string; imageUrl: string | null; viewCount: number; likeCount: number; commentCount: number; createdAt: string };

export type PostListResponse = { galleryId: number; galleryName: string; currentSort: PostSort; searchedKeyword: string | null; totalCount: number; posts: PostListItem[] };

export type PostDetailResponse = { postId: number; gallery: { galleryId: number; name: string }; writer: PostWriter; title: string; content: string; imageUrl: string | null; viewCount: number; likeCount: number; dislikeCount: number; commentCount: number; isLiked: boolean; isDisliked: boolean; createdAt: string; updatedAt: string | null };

export type PostCreateResponse = { postId: number };

export type PostComment = {
  commentId: number;
  parentCommentId: number | null;
  writer: { userId: number; nickname: string | null; profileImageUrl: string | null };
  content: string;
  replyCount: number;
  createdAt: string;
};
export type PostCommentPage = {
  postId: number; parentCommentId: number | null; page: number; size: number;
  totalCount: number; comments: PostComment[];
};

export type PostUpdateResponse = { postId: number };

export type GoogleLoginResponse = { accessToken: string; refreshToken: string; tokenType: string; user: { userId: number; nickname: string; profileImageUrl: string | null } };

export type TokenRefreshResponse = { accessToken: string; refreshToken: string; tokenType: string };
