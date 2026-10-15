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
  hasPendingContribution: boolean;
  hasApprovedContribution: boolean;
  author: { userId: number; nickname: string; profileImageUrl: string | null };
  participants: { userId: number; nickname: string; role: string }[];
  createdAt: string;
};

export type ShortsPageDto = {
  items: ShortItemDto[];
  page: { nextCursor: number | null; hasMore: boolean; size: number };
};

// GET /api/v1/galleries, GET /api/v1/galleries/subscribed 의 배열 원소.
// description은 null일 수 있지만 키는 항상 온다 — 페이로드 DTO에 @JsonInclude(NON_NULL)이 없다.
// 갤러리 이미지는 백엔드에 컬럼 자체가 없어 응답에 들어오지 않는다.
export type GalleryListItem = { galleryId: number; name: string; description: string | null; subscriberCount: number; createdAt: string };

export type GallerySubscribeResponse = { galleryId: number };

/**
 * 조회수 기록 응답(202). `counted`는 실제로 집계됐는지 - 같은 조회자가 중복 제거 창(기본 30분)
 * 안에 다시 열면 `false`다.
 *
 * 이 API만 봉투가 다르다(`errorCode` 없는 별도 ApiResponse 클래스). 성공 응답만 쓰므로
 * 공통 ApiResponse 타입으로 받아도 문제없다 - errorCode가 선택 필드라서다.
 */
export type ContentViewResponse = { contentId: number; counted: boolean };

export type PostWriter = { userId: number; nickname: string; profileImageUrl: string | null };

export type PostSort = "LATEST" | "POPULAR" | "OLDEST";

export type PostListItem = { postId: number; writer: PostWriter; title: string; imageUrl: string | null; viewCount: number; likeCount: number; dislikeCount: number; commentCount: number; createdAt: string };

export type PostListResponse = { galleryId: number; galleryName: string; currentSort: PostSort; searchedKeyword: string | null; totalCount: number; posts: PostListItem[] };

export type PostDetailResponse = { postId: number; gallery: { galleryId: number; name: string }; writer: PostWriter; title: string; content: string; imageUrl: string | null; viewCount: number; likeCount: number; dislikeCount: number; commentCount: number; isLiked: boolean; isDisliked: boolean; isBookmarked: boolean; createdAt: string; updatedAt: string | null };

export type PostCreateResponse = { postId: number };

export type PostComment = {
  commentId: number;
  parentCommentId: number | null;
  writer: { userId: number; nickname: string | null; profileImageUrl: string | null };
  content: string;
  replyCount: number;
  likeCount: number;
  dislikeCount: number;
  isLiked: boolean;
  isDisliked: boolean;
  createdAt: string;
};
export type PostCommentPage = {
  postId: number; parentCommentId: number | null; page: number; size: number;
  totalCount: number; comments: PostComment[];
};

export type ShortComment = {
  commentId: number;
  parentCommentId: number | null;
  content: string;
  writer: PostWriter;
  likeCount: number;
  dislikeCount: number;
  replyCount: number;
  isLiked: boolean;
  isDisliked: boolean;
  createdAt: string;
};
export type ShortCommentList = { shortId: number; comments: ShortComment[] };

export type PostUpdateResponse = { postId: number };

export type GoogleLoginResponse = { accessToken: string; refreshToken: string; tokenType: string; firstLogin: boolean; user: { userId: number; nickname: string; profileImageUrl: string | null } };

export type TokenRefreshResponse = { accessToken: string; refreshToken: string; tokenType: string };

export type UserProfile = {
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
  explanation: string | null;
  primaryInstrument: string | null;
  relations: { followerCount: number; followingCount: number; isFollowing: boolean };
  activities: {
    postCount: number;
    posts: { postId: number; title: string; thumbnailUrl: string | null }[];
    participatedShorts: { shortId: number; title: string; albumImageUrl: string | null }[];
    pinnedShorts: { shortId: number; title: string; albumImageUrl: string | null; mediaUrl: string | null; displayOrder: number }[];
  };
};
