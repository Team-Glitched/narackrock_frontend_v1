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
let sessionVersion = 0;
let refreshInFlight: { version: number; promise: Promise<boolean> } | null = null;

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
  sessionVersion++;
  accessToken = session.accessToken;
  refreshToken = session.refreshToken;
  setCurrentUserId(session.userId);
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(authSessionStorageKey, JSON.stringify(session)); }
    catch { /* 메모리 세션은 계속 사용할 수 있다. */ }
  }
}

export function clearAuthSession(): void {
  sessionVersion++;
  accessToken = null;
  refreshToken = null;
  setCurrentUserId(null);
  if (typeof window !== "undefined") {
    try { window.localStorage.removeItem(authSessionStorageKey); }
    catch { /* 이미 메모리 세션은 제거됐다. */ }
  }
}

// 로그인/로그아웃 시 사용자별 화면 상태를 다시 불러와야 한다.
// 화면이 이 변화를 구독할 수 있도록 열어 둔다 (useSyncExternalStore용).
export function subscribeCurrentUserId(listener: (userId: number | null) => void): () => void {
  currentUserListeners.add(listener);
  return () => { currentUserListeners.delete(listener); };
}

async function responseError(response: Response): Promise<ApiError> {
  const body = await response.text();
  const fallbackMessage = response.status === 401
    ? "로그인이 만료되었습니다. 다시 로그인해 주세요."
    : "요청을 처리하지 못했습니다.";
  let message = body.trim() || fallbackMessage;
  let errorCode: string | undefined;

  try {
    const parsed = JSON.parse(body) as { message?: string; errorCode?: string };
    message = parsed.message?.trim() || fallbackMessage;
    errorCode = parsed.errorCode;
  } catch { /* plain text response */ }

  return new ApiError(response.status, message, errorCode);
}

async function renewSession(version: number): Promise<boolean> {
  if (sessionVersion !== version || refreshToken == null) return false;
  if (refreshInFlight?.version === version) return refreshInFlight.promise;

  const tokenToRotate = refreshToken;
  const promise = (async () => {
    const response = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokenToRotate }),
      credentials: "omit",
    });
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        if (sessionVersion === version && refreshToken === tokenToRotate) clearAuthSession();
        return false;
      }
      throw await responseError(response);
    }

    const result = await response.json() as {
      data?: { accessToken?: string; refreshToken?: string };
    };
    if (!result.data?.accessToken || !result.data.refreshToken) {
      throw new Error("토큰 갱신 응답이 올바르지 않습니다.");
    }
    if (sessionVersion !== version || refreshToken !== tokenToRotate) return false;

    accessToken = result.data.accessToken;
    refreshToken = result.data.refreshToken;
    if (typeof window !== "undefined" && currentUserId != null) {
      try {
        window.localStorage.setItem(authSessionStorageKey, JSON.stringify({
          accessToken, refreshToken, userId: currentUserId,
        }));
      } catch { /* 메모리 세션은 계속 사용할 수 있다. */ }
    }
    return true;
  })();

  refreshInFlight = { version, promise };
  try { return await promise; }
  finally {
    if (refreshInFlight?.promise === promise) refreshInFlight = null;
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const requestAccessToken = accessToken;
  const requestSessionVersion = sessionVersion;
  const isAuthRequest = /^\/api\/v1\/auth\//.test(path);
  const usesStoredSession = !isAuthRequest && requestAccessToken != null && !headers.has("Authorization");

  if (init?.body != null && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (usesStoredSession) headers.set("Authorization", `Bearer ${requestAccessToken}`);

  const url = /^https?:\/\//.test(path) ? path : `${apiBaseUrl}${path}`;
  const send = (requestHeaders: Headers) => fetch(url, {
    ...init,
    headers: requestHeaders,
    credentials: init?.credentials ?? "omit",
  });
  let response = await send(headers);

  if (response.status === 401 && usesStoredSession && sessionVersion === requestSessionVersion) {
    // 다른 요청이 이미 갱신했다면 회전된 refresh token을 다시 사용하지 않는다.
    if (accessToken === requestAccessToken) await renewSession(requestSessionVersion);
    if (sessionVersion === requestSessionVersion && accessToken && accessToken !== requestAccessToken) {
      const retryHeaders = new Headers(headers);
      retryHeaders.set("Authorization", `Bearer ${accessToken}`);
      response = await send(retryHeaders);
    }
  }

  if (!response.ok) {
    throw await responseError(response);
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
