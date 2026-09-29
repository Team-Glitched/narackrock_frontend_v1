const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
export class ApiError extends Error {
  status: number;
  errorCode?: string;

  constructor(status: number, message: string, errorCode?: string) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }
}

const authSessionStorageKey = "narackrock.auth-session";

type StoredAuthSession = {
  accessToken: string;
  refreshToken: string;
  userId: number;
};

function loadStoredSession(): StoredAuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(authSessionStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredAuthSession>;
    return typeof parsed.accessToken === "string"
      && typeof parsed.refreshToken === "string"
      && typeof parsed.userId === "number"
      ? parsed as StoredAuthSession
      : null;
  } catch {
    return null;
  }
}

const storedSession = loadStoredSession();
let accessToken: string | null = storedSession?.accessToken ?? null;
let refreshToken: string | null = storedSession?.refreshToken ?? null;
export function setAccessToken(token: string | null): void { accessToken = token; }
export function getAccessToken(): string | null { return accessToken; }
export function getRefreshToken(): string | null { return refreshToken; }

// 내 글/댓글인지 판별하려면 응답의 writer.userId와 비교할 로그인 사용자 id가 필요하다.
// 로그인 응답에만 담겨 오므로 토큰과 함께 보관한다.
let currentUserId: number | null = storedSession?.userId ?? null;
const currentUserListeners = new Set<(userId: number | null) => void>();

export function setCurrentUserId(userId: number | null): void {
  currentUserId = userId;
  currentUserListeners.forEach(listener => listener(userId));
}
export function getCurrentUserId(): number | null { return currentUserId; }

export function setAuthSession(session: StoredAuthSession): void {
  accessToken = session.accessToken;
  refreshToken = session.refreshToken;
  setCurrentUserId(session.userId);
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(authSessionStorageKey, JSON.stringify(session)); }
    catch { /* 메모리 세션은 계속 사용할 수 있다. */ }
  }
}

export function clearAuthSession(): void {
  accessToken = null;
  refreshToken = null;
  setCurrentUserId(null);
  if (typeof window !== "undefined") {
    try { window.localStorage.removeItem(authSessionStorageKey); }
    catch { /* 이미 메모리 세션은 제거됐다. */ }
  }
}

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
    let errorCode: string | undefined;
    try {
      const parsed = JSON.parse(body) as { message?: string; errorCode?: string };
      message = parsed.message || body;
      errorCode = parsed.errorCode;
    } catch { /* plain text response */ }
    throw new ApiError(response.status, message, errorCode);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
