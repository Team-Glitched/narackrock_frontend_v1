import { apiRequest } from "./client";
import type {
  ApiResponse,
  PostCreateResponse,
  PostDetailResponse,
  PostListResponse,
  PostUpdateResponse,
} from "./contracts";

// 갤러리 목록 API가 아직 백엔드에 없어 임시로 고정한 값. narackrock/docs/plan.md 참고.
export const DEFAULT_GALLERY_ID = 1;

export function fetchPosts(galleryId: number, page = 0, size = 20): Promise<PostListResponse> {
  return apiRequest<ApiResponse<PostListResponse>>(
    `/api/v1/galleries/${galleryId}/posts?page=${page}&size=${size}`
  ).then((response) => response.data);
}

// 상세 조회는 로그인(Authorization 헤더)이 필요하다 — 백엔드가 isLiked/isDisliked를 계산하려면 요청자 식별이 필요하기 때문.
export function fetchPost(postId: number): Promise<PostDetailResponse> {
  return apiRequest<ApiResponse<PostDetailResponse>>(`/api/v1/posts/${postId}`).then((response) => response.data);
}

// 아래 3개도 로그인(Authorization 헤더)이 필요하다 — auth.ts의 loginWithGoogle()로 먼저 토큰을 발급받아야 한다.

export function createPost(galleryId: number, title: string, content: string): Promise<PostCreateResponse> {
  return apiRequest<ApiResponse<PostCreateResponse>>(`/api/v1/galleries/${galleryId}/posts`, {
    method: "POST",
    body: JSON.stringify({ title, content }),
  }).then((response) => response.data);
}

export function updatePost(postId: number, title: string, content: string): Promise<PostUpdateResponse> {
  return apiRequest<ApiResponse<PostUpdateResponse>>(`/api/v1/posts/${postId}`, {
    method: "PUT",
    body: JSON.stringify({ title, content }),
  }).then((response) => response.data);
}

export function deletePost(postId: number): Promise<void> {
  return apiRequest<ApiResponse<void>>(`/api/v1/posts/${postId}`, {
    method: "DELETE",
  }).then(() => undefined);
}
