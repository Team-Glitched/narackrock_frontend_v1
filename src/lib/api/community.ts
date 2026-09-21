import { ApiError, apiRequest } from "./client";
import type { GalleryListItem, GallerySubscribeResponse, PostCommentPage } from "./contracts";

/**
 * 에러 응답 본문의 `errorCode`를 꺼낸다.
 *
 * `apiRequest`는 실패 시 본문 텍스트를 그대로 `ApiError.message`에 담는다. 커뮤니티 API의
 * 에러 봉투는 `{success, errorCode, message}` JSON이라 여기서 다시 파싱하면 코드로 분기할 수 있다.
 * 단 401만은 Spring Security 필터가 `sendError`로 내보내 JSON이 아니다(constraints-harness.md C3)
 * — 그래서 파싱 실패를 정상 경로로 보고 null을 돌려준다.
 *
 * client.ts를 고쳐 ApiError에 필드를 더하는 쪽이 깔끔하지만, 그 파일은 통합 시
 * 전송 계층이 통째로 교체될 예정이라(branch-strategy.md §2-1) 충돌면을 늘리지 않기로 했다.
 */
function errorCodeOf(error: unknown): string | null {
  if (!(error instanceof ApiError)) return null;
  try {
    const parsed: unknown = JSON.parse(error.message);
    if (typeof parsed === "object" && parsed !== null && "errorCode" in parsed) {
      const code = (parsed as { errorCode: unknown }).errorCode;
      return typeof code === "string" ? code : null;
    }
  } catch {
    // 401 등 JSON이 아닌 본문 — 코드로 구분할 수 없다.
  }
  return null;
}

export function fetchPostComments(postId: number, parentCommentId: number | null = null, page = 0): Promise<PostCommentPage> {
  const query = new URLSearchParams({ page: String(page), size: "20" });
  if (parentCommentId !== null) query.set("parentCommentId", String(parentCommentId));
  return apiRequest<ApiResponse<PostCommentPage>>(`/api/v1/posts/${postId}/comments?${query}`).then(r => r.data);
}

export function createPostComment(postId: number, content: string, parentCommentId: number | null = null): Promise<{ commentId: number }> {
  return apiRequest<ApiResponse<{ commentId: number }>>(`/api/v1/posts/${postId}/comments`, {
    method: "POST", body: JSON.stringify({ content, parentCommentId }),
  }).then(r => r.data);
}

// 수정·삭제 경로에는 postId가 없다 — 댓글 id가 전역 고유해서 백엔드가 그렇게 정의했다.
export function updatePostComment(commentId: number, content: string): Promise<{ commentId: number }> {
  return apiRequest<ApiResponse<{ commentId: number }>>(`/api/v1/posts/comments/${commentId}`, {
    method: "PUT", body: JSON.stringify({ content }),
  }).then(r => r.data);
}

export function deletePostComment(commentId: number): Promise<void> {
  // 삭제 응답에는 data 키가 없으므로(NON_NULL 봉투) 본문을 읽지 않는다.
  return apiRequest<ApiResponse<void>>(`/api/v1/posts/comments/${commentId}`, { method: "DELETE" }).then(() => undefined);
}
import type {
  ApiResponse,
  PostCreateResponse,
  PostDetailResponse,
  PostListResponse,
  PostSort,
  PostUpdateResponse,
} from "./contracts";

/**
 * 갤러리를 고르지 않고 게시글을 보여주는 화면(홈 "인기 글", "인기글", 커뮤니티 탭의 "게시글")이
 * 쓰는 갤러리 id.
 *
 * 갤러리 목록 API는 이제 있다 — 남아 있는 이유는 다르다. **갤러리를 가로지르는 게시글 통합
 * 조회 API가 없어서**(게시글 조회는 항상 `/galleries/{id}/posts`) 이 화면들이 갤러리 하나를
 * 골라야만 한다. 통합 조회나 인기글 API가 생기면 그때 제거한다.
 *
 * 커뮤니티 목록·상세는 더 이상 이 값을 쓰지 않고 서버가 준 galleryId를 쓴다.
 */
export const DEFAULT_GALLERY_ID = 1;

// 전체 갤러리 목록. 비로그인도 호출할 수 있고, 페이지네이션 없이 전량이 온다.
// 정렬은 서버가 구독자 수 내림차순 → id 오름차순으로 고정한다.
export function fetchGalleries(): Promise<GalleryListItem[]> {
  return apiRequest<ApiResponse<GalleryListItem[]>>("/api/v1/galleries").then(r => r.data);
}

// 요청자가 구독한 갤러리만. 인증 필수 — 비로그인으로 부르면 401(빈 본문)이다.
export function fetchSubscribedGalleries(): Promise<GalleryListItem[]> {
  return apiRequest<ApiResponse<GalleryListItem[]>>("/api/v1/galleries/subscribed").then(r => r.data);
}

/**
 * 갤러리 구독. 이미 구독 중이면 서버가 409 ALREADY_SUBSCRIBED를 준다(멱등이 아니다).
 *
 * 여기서는 그 409를 **성공으로 흡수한다** — 원하는 상태(구독 중)가 이미 달성됐기 때문이다.
 * 다른 탭에서 먼저 눌렀거나 낙관적 갱신이 어긋난 상황인데, 이때 에러를 띄우면 사용자는
 * 버튼이 고장난 것으로 본다. 갤러리가 없어서 나는 404 GALLERY_NOT_FOUND는 진짜 실패라 그대로 던진다.
 */
export function subscribeGallery(galleryId: number): Promise<void> {
  return apiRequest<ApiResponse<GallerySubscribeResponse>>(`/api/v1/galleries/${galleryId}/subscriptions`, {
    method: "POST",
  }).then(() => undefined).catch((error: unknown) => {
    if (errorCodeOf(error) === "ALREADY_SUBSCRIBED") return;
    throw error;
  });
}

// 구독 취소. 구독 중이 아니면 404 NOT_SUBSCRIBED — 구독과 같은 이유로 성공으로 흡수한다.
// 응답에 data 키가 없으므로(NON_NULL 봉투) 본문을 읽지 않는다.
export function unsubscribeGallery(galleryId: number): Promise<void> {
  return apiRequest<ApiResponse<void>>(`/api/v1/galleries/${galleryId}/subscriptions`, {
    method: "DELETE",
  }).then(() => undefined).catch((error: unknown) => {
    if (errorCodeOf(error) === "NOT_SUBSCRIBED") return;
    throw error;
  });
}

export type PostListQuery = {
  page?: number;
  size?: number;
  sort?: PostSort;
  /** 검색어. 공백만 있거나 비어 있으면 검색하지 않은 것으로 보고 파라미터를 보내지 않는다. */
  keyword?: string | null;
};

/**
 * 게시글 목록.
 *
 * `keyword`를 **빈 문자열로 보내면 400(INVALID_SEARCH_KEYWORD)** 이다. 서버에게 "검색 안 함"은
 * 빈 값이 아니라 파라미터의 부재이므로, 여기서 trim 후 비면 아예 빼고 보낸다. 검색창을 비우는
 * 동작이 그대로 요청이 되기 때문에 이 구분은 실제로 자주 걸린다.
 *
 * `size`는 1~100을 벗어나면 400(VALIDATION_ERROR)이다.
 */
export function fetchPosts(galleryId: number, query: PostListQuery = {}): Promise<PostListResponse> {
  const { page = 0, size = 20, sort = "LATEST", keyword } = query;
  const params = new URLSearchParams({ page: String(page), size: String(size), sort });
  const trimmed = keyword?.trim();
  if (trimmed) params.set("keyword", trimmed);
  return apiRequest<ApiResponse<PostListResponse>>(
    `/api/v1/galleries/${galleryId}/posts?${params}`
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
