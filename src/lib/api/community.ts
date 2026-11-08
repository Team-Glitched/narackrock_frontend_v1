import { ApiError, apiRequest } from "./client";
import { getDeviceId } from "./device-id";
import type {
  ContentViewResponse,
  GalleryListItem,
  GallerySubscribeResponse,
  PostCommentPage,
  PostListItem,
} from "./contracts";

/**
 * 에러 응답의 `errorCode`를 꺼낸다.
 *
 * 커뮤니티 API의 에러 봉투는 `{success, errorCode, message}` JSON이고, `apiRequest`가 이를 파싱해
 * `ApiError.errorCode`에 담아 준다. 401만은 Spring Security 필터가 `sendError`로 내보내 JSON이
 * 아니므로(constraints-harness.md C3) 코드가 없다 — 그때는 null이다.
 */
function errorCodeOf(error: unknown): string | null {
  return error instanceof ApiError ? (error.errorCode ?? null) : null;
}

export function fetchPostComments(
  postId: number,
  parentCommentId: number | null = null,
  page = 0,
  signal?: AbortSignal,
): Promise<PostCommentPage> {
  const query = new URLSearchParams({ page: String(page), size: "20" });
  if (parentCommentId !== null) query.set("parentCommentId", String(parentCommentId));
  return apiRequest<ApiResponse<PostCommentPage>>(`/api/v1/posts/${postId}/comments?${query}`, { signal }).then(
    (r) => r.data,
  );
}

export function createPostComment(
  postId: number,
  content: string,
  parentCommentId: number | null = null,
): Promise<{ commentId: number }> {
  return apiRequest<ApiResponse<{ commentId: number }>>(`/api/v1/posts/${postId}/comments`, {
    method: "POST",
    body: JSON.stringify({ content, parentCommentId }),
  }).then((r) => r.data);
}

// 수정·삭제 경로에는 postId가 없다 — 댓글 id가 전역 고유해서 백엔드가 그렇게 정의했다.
export function updatePostComment(
  commentId: number,
  content: string,
): Promise<{ commentId: number }> {
  return apiRequest<ApiResponse<{ commentId: number }>>(`/api/v1/posts/comments/${commentId}`, {
    method: "PUT",
    body: JSON.stringify({ content }),
  }).then((r) => r.data);
}

export function deletePostComment(commentId: number): Promise<void> {
  // 삭제 응답에는 data 키가 없으므로(NON_NULL 봉투) 본문을 읽지 않는다.
  return apiRequest<ApiResponse<void>>(`/api/v1/posts/comments/${commentId}`, {
    method: "DELETE",
  }).then(() => undefined);
}

/** Toggles a post comment reaction; the response carries both reaction states and counts. */
export function reactToPostComment(
  commentId: number,
  kind: "like" | "dislike",
): Promise<{ isLiked: boolean; isDisliked: boolean; likeCount: number; dislikeCount: number }> {
  return apiRequest<ApiResponse<{ isLiked: boolean; isDisliked: boolean; likeCount: number; dislikeCount: number }>>(
    `/api/v1/posts/comments/${commentId}/${kind === "like" ? "likes" : "dislikes"}`,
    { method: "POST" },
  ).then((r) => r.data);
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
 * 갤러리를 고르지 않는 게시글 화면(소셜의 "게시글" 탭)과 작성 기본 대상이 쓰는 갤러리 id.
 *
 * 인기글은 이제 `GET /posts/popular`(갤러리 통합)를 쓴다. 남은 이유는 **갤러리를 가로지르는 최신
 * 게시글 목록 API가 없어서**(게시글 목록은 `/galleries/{id}/posts`뿐) 소셜 게시글 탭이 갤러리 하나를
 * 골라야만 하기 때문이다. 통합 최신 목록 API가 생기면 그때 제거한다.
 */
export const DEFAULT_GALLERY_ID = 1;

// 전체 갤러리 목록. 비로그인도 호출할 수 있고, 페이지네이션 없이 전량이 온다.
// 정렬은 서버가 구독자 수 내림차순 → id 오름차순으로 고정한다.
export function fetchGalleries(signal?: AbortSignal): Promise<GalleryListItem[]> {
  return apiRequest<ApiResponse<GalleryListItem[]>>("/api/v1/galleries", { signal }).then((r) => r.data);
}

export function fetchManageableGalleries(signal?: AbortSignal): Promise<GalleryListItem[]> {
  return apiRequest<ApiResponse<GalleryListItem[]>>("/api/v1/galleries/manageable", { signal })
    .then((response) => response.data);
}

// 요청자가 구독한 갤러리만. 인증 필수 — 비로그인으로 부르면 401(빈 본문)이다.
export function fetchSubscribedGalleries(signal?: AbortSignal): Promise<GalleryListItem[]> {
  return apiRequest<ApiResponse<GalleryListItem[]>>("/api/v1/galleries/subscribed", { signal }).then(
    (r) => r.data,
  );
}

/**
 * 갤러리 구독. 이미 구독 중이면 서버가 409 ALREADY_SUBSCRIBED를 준다(멱등이 아니다).
 *
 * 여기서는 그 409를 **성공으로 흡수한다** — 원하는 상태(구독 중)가 이미 달성됐기 때문이다.
 * 다른 탭에서 먼저 눌렀거나 낙관적 갱신이 어긋난 상황인데, 이때 에러를 띄우면 사용자는
 * 버튼이 고장난 것으로 본다. 갤러리가 없어서 나는 404 GALLERY_NOT_FOUND는 진짜 실패라 그대로 던진다.
 */
export function subscribeGallery(galleryId: number): Promise<void> {
  return apiRequest<ApiResponse<GallerySubscribeResponse>>(
    `/api/v1/galleries/${galleryId}/subscriptions`,
    {
      method: "POST",
    },
  )
    .then(() => undefined)
    .catch((error: unknown) => {
      if (errorCodeOf(error) === "ALREADY_SUBSCRIBED") return;
      throw error;
    });
}

// 구독 취소. 구독 중이 아니면 404 NOT_SUBSCRIBED — 구독과 같은 이유로 성공으로 흡수한다.
// 응답에 data 키가 없으므로(NON_NULL 봉투) 본문을 읽지 않는다.
export function unsubscribeGallery(galleryId: number): Promise<void> {
  return apiRequest<ApiResponse<void>>(`/api/v1/galleries/${galleryId}/subscriptions`, {
    method: "DELETE",
  })
    .then(() => undefined)
    .catch((error: unknown) => {
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
export function fetchPosts(
  galleryId: number,
  query: PostListQuery = {},
  signal?: AbortSignal,
): Promise<PostListResponse> {
  const { page = 0, size = 20, sort = "LATEST", keyword } = query;
  const params = new URLSearchParams({ page: String(page), size: String(size), sort });
  const trimmed = keyword?.trim();
  if (trimmed) params.set("keyword", trimmed);
  return apiRequest<ApiResponse<PostListResponse>>(
    `/api/v1/galleries/${galleryId}/posts?${params}`, { signal },
  ).then((response) => response.data);
}

// 상세 조회는 로그인(Authorization 헤더)이 필요하다 — 백엔드가 isLiked/isDisliked를 계산하려면 요청자 식별이 필요하기 때문.
export function fetchPost(postId: number, signal?: AbortSignal): Promise<PostDetailResponse> {
  return apiRequest<ApiResponse<PostDetailResponse>>(`/api/v1/posts/${postId}`, { signal }).then(
    (response) => response.data,
  );
}

export function getLikedPostIds(signal?: AbortSignal): Promise<number[]> {
  return apiRequest<ApiResponse<number[]>>("/api/v1/users/me/liked-posts", { signal }).then(
    (response) => response.data,
  );
}

// 아래 3개도 로그인(Authorization 헤더)이 필요하다 — auth.ts의 loginWithGoogle()로 먼저 토큰을 발급받아야 한다.

export function createPost(
  galleryId: number,
  title: string,
  content: string,
  imageFileId: number | null = null,
): Promise<PostCreateResponse> {
  return apiRequest<ApiResponse<PostCreateResponse>>(`/api/v1/galleries/${galleryId}/posts`, {
    method: "POST",
    body: JSON.stringify({ title, content, imageFileId }),
  }).then((response) => response.data);
}

export function updatePost(
  postId: number,
  title: string,
  content: string,
): Promise<PostUpdateResponse> {
  return apiRequest<ApiResponse<PostUpdateResponse>>(`/api/v1/posts/${postId}`, {
    method: "PUT",
    body: JSON.stringify({ title, content }),
  }).then((response) => response.data);
}

/**
 * 게시글 조회수 기록. 게시글을 실제로 읽는 시점(상세 화면 진입)에 한 번 부른다.
 *
 * 비로그인도 집계되지만 그러려면 `X-Device-Id`가 있어야 한다 - 인증도 기기 ID도 없으면
 * 400(VIEWER_ID_REQUIRED)이다. 로그인 상태면 서버가 토큰의 사용자로 식별하므로 이 헤더는
 * 무시되지만, 로그인 여부를 여기서 따지지 않아도 되도록 항상 함께 보낸다.
 *
 * 202 Accepted이고 집계는 Redis에 먼저 쌓였다가 주기적으로 DB에 반영된다. 따라서 이 호출
 * 직후에 게시글을 다시 조회해도 늘어난 값이 바로 보이지는 않는다. **화면에서 보정하지 말 것** -
 * `counted`가 true라고 표시값에 1을 더했더니, 그 사이 서버 동기화가 끝난 뒤 재조회한 값에
 * 또 더해져 조회수가 2로 보이는 버그가 났다(댓글 등록 후 재조회에서 실제로 발생). 조회수는
 * 원래 최종적 일관성을 갖는 값이니 서버가 주는 대로 보여준다.
 *
 * 조회수는 본문을 읽는 데 곁다리라서 실패해도 화면을 막지 않는다. 호출하는 쪽에서 삼킨다.
 */
export function recordPostView(postId: number): Promise<ContentViewResponse> {
  return apiRequest<ApiResponse<ContentViewResponse>>(`/api/v1/posts/${postId}/views`, {
    method: "POST",
    headers: { "X-Device-Id": getDeviceId() },
  }).then((response) => response.data);
}

export function deletePost(postId: number): Promise<void> {
  return apiRequest<ApiResponse<void>>(`/api/v1/posts/${postId}`, {
    method: "DELETE",
  }).then(() => undefined);
}

export type PostReaction = { isLiked: boolean; isDisliked: boolean; likeCount: number; dislikeCount: number };

/** Toggles a post reaction; the response contains both reaction states and counts. */
export function reactToPost(postId: number, kind: "like" | "dislike"): Promise<PostReaction> {
  return apiRequest<ApiResponse<PostReaction>>(`/api/v1/posts/${postId}/${kind === "like" ? "likes" : "dislikes"}`, {
    method: "POST",
  }).then((response) => response.data);
}

export function togglePostBookmark(postId: number): Promise<{ postId: number; isBookmarked: boolean }> {
  return apiRequest<ApiResponse<{ postId: number; isBookmarked: boolean }>>(`/api/v1/posts/${postId}/bookmark`, {
    method: "POST",
  }).then((response) => response.data);
}

export function getPostShareLink(postId: number): Promise<{ postId: number; shareUrl: string }> {
  return apiRequest<ApiResponse<{ postId: number; shareUrl: string }>>(`/api/v1/posts/${postId}/share`, {
    method: "POST",
  }).then((response) => response.data);
}

export type GalleryRole = { galleryId: number; galleryRole: "MANAGER" | null; isAdmin: boolean; canManage: boolean };

/** The caller's moderation rights in one gallery; ownership fields are never used as permission. */
export function getMyGalleryRole(galleryId: number, signal?: AbortSignal): Promise<GalleryRole> {
  return apiRequest<ApiResponse<GalleryRole>>(`/api/v1/galleries/${galleryId}/manage/me`, { signal }).then((r) => r.data);
}

export function updateGalleryDescription(galleryId: number, description: string): Promise<void> {
  return apiRequest(`/api/v1/galleries/${galleryId}/manage`, {
    method: "PATCH",
    body: JSON.stringify({ description }),
  }).then(() => undefined);
}

export type GalleryModerationLog = {
  logId: number;
  actionType: string;
  actorId: number;
  targetUserId: number | null;
  targetId: number | null;
  reason: string | null;
  createdAt: string;
};
export type GalleryBan = {
  banId: number;
  userId: number;
  actorId: number;
  banType: "SUSPEND" | "EXPEL";
  reason: string;
  bannedUntil: string | null;
  liftedAt: string | null;
  createdAt: string;
  active: boolean;
};

export function getGalleryModerationLogs(galleryId: number, cursor: number | null) {
  return apiRequest<ApiResponse<{ logs: GalleryModerationLog[]; nextCursor: number | null; hasNext: boolean }>>(
    `/api/v1/galleries/${galleryId}/manage/logs?size=20${cursor === null ? "" : `&cursor=${cursor}`}`,
  ).then((r) => r.data);
}

export function getGalleryBans(galleryId: number, cursor: number | null) {
  return apiRequest<ApiResponse<{ bans: GalleryBan[]; nextCursor: number | null; hasNext: boolean }>>(
    `/api/v1/galleries/${galleryId}/manage/bans?size=20${cursor === null ? "" : `&cursor=${cursor}`}`,
  ).then((r) => r.data);
}

export function sanctionGalleryMember(
  galleryId: number,
  body: { userId: number; type: "SUSPEND" | "EXPEL"; durationDays: number | null; reason: string },
): Promise<{ banId: number }> {
  return apiRequest<ApiResponse<{ banId: number }>>(`/api/v1/galleries/${galleryId}/manage/bans`, {
    method: "POST",
    body: JSON.stringify(body),
  }).then((r) => r.data);
}

export function liftGalleryBan(galleryId: number, banId: number): Promise<void> {
  return apiRequest(`/api/v1/galleries/${galleryId}/manage/bans/${banId}/lift`, { method: "PATCH" }).then(() => undefined);
}

/** Moderator deletion with a recorded reason; distinct from the author's own delete endpoints. */
export function moderateGalleryContent(
  galleryId: number,
  kind: "posts" | "comments",
  id: number,
  reason: string,
): Promise<void> {
  return apiRequest(`/api/v1/galleries/${galleryId}/manage/${kind}/${id}/delete`, {
    method: "PATCH",
    body: JSON.stringify({ reason }),
  }).then(() => undefined);
}

export type MyGalleryProposal = {
  proposalId: number;
  name: string;
  description: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectionReason: string | null;
  createdAt: string;
};

/** Community creation is a proposal reviewed by a platform admin, not an immediate gallery. */
export function proposeGallery(name: string, description: string): Promise<{ proposalId: number; status: "PENDING" }> {
  return apiRequest<ApiResponse<{ proposalId: number; status: "PENDING" }>>("/api/v1/gallery-proposals", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  }).then((r) => r.data);
}

export function getMyGalleryProposals(signal?: AbortSignal): Promise<MyGalleryProposal[]> {
  return apiRequest<ApiResponse<MyGalleryProposal[]>>("/api/v1/gallery-proposals/me", { signal }).then((r) => r.data);
}

export type PopularPost = PostListItem & {
  gallery: { galleryId: number; name: string };
  contentPreview: string;
  dislikeCount: number;
};

/** Popular posts across every gallery. */
export function getPopularPosts(page = 0, size = 20, signal?: AbortSignal) {
  return apiRequest<ApiResponse<{ page: number; size: number; totalCount: number; posts: PopularPost[] }>>(
    `/api/v1/posts/popular?page=${page}&size=${size}`,
    { signal },
  ).then((r) => r.data);
}
