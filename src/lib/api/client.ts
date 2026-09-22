const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

// 로그인 세션 동안만 유지하는 액세스 토큰. 이 프런트는 아직 임시 화면이라 새로고침 시 유지는 하지 않는다.
let accessToken: string | null = null;
export function setAccessToken(token: string | null): void { accessToken = token; }
export function getAccessToken(): string | null { return accessToken; }

// 내 글/댓글인지 판별하려면 응답의 writer.userId와 비교할 로그인 사용자 id가 필요하다.
// 로그인 응답에만 담겨 오므로 토큰과 함께 보관한다.
let currentUserId: number | null = null;
const currentUserListeners = new Set<(userId: number | null) => void>();

export function setCurrentUserId(userId: number | null): void {
  currentUserId = userId;
  currentUserListeners.forEach(listener => listener(userId));
}
export function getCurrentUserId(): number | null { return currentUserId; }

// 로그인/로그아웃 시 사용자별 화면 상태를 다시 불러와야 한다. 화면이 이 변화를
// 구독할 수 있도록 열어 둔다 (useSyncExternalStore용).
export function subscribeCurrentUserId(listener: (userId: number | null) => void): () => void {
  currentUserListeners.add(listener);
  return () => { currentUserListeners.delete(listener); };
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (accessToken && !headers.has("Authorization")) headers.set("Authorization", `Bearer ${accessToken}`);

  const url = /^https?:\/\//.test(path) ? path : `${apiBaseUrl}${path}`;
  const response = await fetch(url, {
    ...init,
    headers,
    credentials: init?.credentials ?? "omit",
  });
  if (!response.ok) {
    const body = await response.text();
    let message = body;
    try { message = (JSON.parse(body) as { message?: string }).message || body; } catch { /* plain text response */ }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
