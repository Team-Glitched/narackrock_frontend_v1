export type SongDto = { id: string; title: string; artistName: string; coverUrl: string | null };
export type UserDto = { id: string; displayName: string; avatarUrl: string | null };

export type ApiResponse<T> = { success: boolean; message: string; errorCode?: string; data: T };

export type PostWriter = { userId: number; nickname: string; profileImageUrl: string | null };

export type PostSort = "LATEST" | "POPULAR" | "OLDEST";

export type PostListItem = { postId: number; writer: PostWriter; title: string; viewCount: number; likeCount: number; commentCount: number; createdAt: string };

export type PostListResponse = { galleryId: number; galleryName: string; currentSort: PostSort; searchedKeyword: string | null; totalCount: number; posts: PostListItem[] };

export type PostDetailResponse = { postId: number; gallery: { galleryId: number; name: string }; writer: PostWriter; title: string; content: string; viewCount: number; likeCount: number; dislikeCount: number; commentCount: number; isLiked: boolean; isDisliked: boolean; createdAt: string; updatedAt: string | null };

export type PostCreateResponse = { postId: number };

export type PostUpdateResponse = { postId: number };

export type GoogleLoginResponse = { accessToken: string; refreshToken: string; tokenType: string; user: { userId: number; nickname: string; profileImageUrl: string | null } };

export type TokenRefreshResponse = { accessToken: string; refreshToken: string; tokenType: string };
