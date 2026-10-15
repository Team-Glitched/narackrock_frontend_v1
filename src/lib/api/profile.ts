import { apiRequest } from "./client.ts";
import type { ApiResponse, UserProfile } from "./contracts.ts";

export async function getProfile(userId: number): Promise<UserProfile> {
  const response = await apiRequest<ApiResponse<UserProfile>>(`/api/v1/users/profiles/${userId}`);
  return response.data;
}

export async function updateProfilePrivacy(isPrivate: boolean): Promise<boolean> {
  const response = await apiRequest<ApiResponse<{ isPrivate: boolean }>>("/api/v1/users/me/profile/privacy", {
    method: "PATCH",
    body: JSON.stringify({ isPrivate }),
  });
  return response.data.isPrivate;
}

export type BookmarkedPost = {
  postId: number;
  title: string;
  contentPreview: string;
  imageUrl: string | null;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  writer: { userId: number; nickname: string; profileImageUrl: string | null };
};

export type BookmarkedShort = {
  shortId: number;
  title: string;
  albumImageUrl: string | null;
  likeCount: number;
  commentCount: number;
  bookmarkedAt: string;
  author: { userId: number; nickname: string; profileImageUrl: string | null };
};

export type BookmarkedPostPage = {
  page: number;
  size: number;
  totalCount: number;
  posts: BookmarkedPost[];
};

export type BookmarkedShortPage = {
  items: BookmarkedShort[];
  page: { nextCursor: number | null; hasMore: boolean; size: number };
};

export async function getBookmarkedPosts(page = 0): Promise<BookmarkedPostPage> {
  const response = await apiRequest<ApiResponse<BookmarkedPostPage>>(
    `/api/v1/users/me/bookmarks/posts?page=${page}&size=20`,
  );
  return response.data;
}

export async function getBookmarkedShorts(cursor?: number): Promise<BookmarkedShortPage> {
  const query = cursor == null ? "" : `?cursor=${encodeURIComponent(cursor)}`;
  const response = await apiRequest<ApiResponse<BookmarkedShortPage>>(
    `/api/v1/users/me/bookmarks/shorts${query}`,
  );
  return response.data;
}

export async function updateProfile(input: {
  nickname: string;
  primaryInstrument: string;
  explanation: string;
}): Promise<{ nickname: string; primaryInstrument: string | null; explanation: string | null }> {
  const response = await apiRequest<ApiResponse<{ nickname: string; primaryInstrument: string | null; explanation: string | null }>>("/api/v1/users/me/profile", {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return response.data;
}

export async function updateProfileImage(image: File): Promise<{ profileImageUrl: string }> {
  const body = new FormData();
  body.append("image", image, image.name);
  const response = await apiRequest<ApiResponse<{ profileImageUrl: string }>>("/api/v1/users/me/profile/image", {
    method: "PATCH",
    body,
  });
  return response.data;
}