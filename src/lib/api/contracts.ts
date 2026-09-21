export type SongDto = { id: string; title: string; artistName: string; coverUrl: string | null };
export type UserDto = { id: string; displayName: string; avatarUrl: string | null };

export type ApiResponse<T> = { success: boolean; message: string; errorCode?: string; data: T };

// GET /api/v1/galleries, GET /api/v1/galleries/subscribed 의 배열 원소.
// description은 null일 수 있지만 키는 항상 온다 — 페이로드 DTO에 @JsonInclude(NON_NULL)이 없다.
// 갤러리 이미지는 백엔드에 컬럼 자체가 없어 응답에 들어오지 않는다.
export type GalleryListItem = { galleryId: number; name: string; description: string | null; subscriberCount: number; createdAt: string };

export type GallerySubscribeResponse = { galleryId: number };

export type PostWriter = { userId: number; nickname: string; profileImageUrl: string | null };

export type PostSort = "LATEST" | "POPULAR" | "OLDEST";

export type PostListItem = { postId: number; writer: PostWriter; title: string; viewCount: number; likeCount: number; commentCount: number; createdAt: string };

export type PostListResponse = { galleryId: number; galleryName: string; currentSort: PostSort; searchedKeyword: string | null; totalCount: number; posts: PostListItem[] };

export type PostDetailResponse = { postId: number; gallery: { galleryId: number; name: string }; writer: PostWriter; title: string; content: string; viewCount: number; likeCount: number; dislikeCount: number; commentCount: number; isLiked: boolean; isDisliked: boolean; createdAt: string; updatedAt: string | null };

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
