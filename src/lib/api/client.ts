import type { ApiResponse, TokenRefreshResponse } from "./contracts.ts";

const apiBaseUrl = (import.meta.env?.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

/** Identifies the backend whose data is stored locally (journals, pending work) so environments never mix. */
export function apiOrigin(): string {
  if (apiBaseUrl) return new URL(apiBaseUrl).origin;
  return typeof window === "undefined" ? "" : window.location.origin;
}

export class ApiError extends Error {
  status: number;
  errorCode?: string;

  constructor(status: number, message: string, errorCode?: string) {
    super(message);
    this.status = status;
    this.errorCode = errorCode;
  }
}

/** A response that belongs to a session which was logged out or replaced while it was in flight. */
export class SessionChangedError extends Error {
  constructor() {
    super("로그인 계정이 바뀌어 이전 요청 결과를 사용하지 않습니다.");
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
    return typeof parsed.accessToken === "string" &&
      typeof parsed.refreshToken === "string" &&
      typeof parsed.userId === "number"
      ? (parsed as StoredAuthSession)
      : null;
  } catch {
    return null;
  }
}

function storeSession(session: StoredAuthSession): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(authSessionStorageKey, JSON.stringify(session));
  } catch {
    /* 메모리 세션은 계속 사용할 수 있다. */
  }
}

const storedSession = loadStoredSession();
let accessToken: string | null = storedSession?.accessToken ?? null;
let refreshToken: string | null = storedSession?.refreshToken ?? null;
// 로그인·로그아웃·계정 전환마다 증가한다. 이전 세션으로 보낸 요청의 결과와 refresh를 버리는 기준이다.
let sessionVersion = 0;
let refreshInFlight: { version: number; promise: Promise<Renewal> } | null = null;

export function getAccessToken(): string | null {
  return accessToken;
}
export function getRefreshToken(): string | null {
  return refreshToken;
}

// 내 글/댓글인지 판별하려면 응답의 writer.userId와 비교할 로그인 사용자 id가 필요하다.
// 로그인 응답에만 담겨 오므로 토큰과 함께 보관한다.
let currentUserId: number | null = storedSession?.userId ?? null;
const currentUserListeners = new Set<(userId: number | null) => void>();

function setCurrentUserId(userId: number | null): void {
  currentUserId = userId;
  currentUserListeners.forEach((listener) => listener(userId));
}

export function getCurrentUserId(): number | null {
  return currentUserId;
}

export function setAuthSession(session: StoredAuthSession): void {
  sessionVersion++;
  accessToken = session.accessToken;
  refreshToken = session.refreshToken;
  setCurrentUserId(session.userId);
  storeSession(session);
}

export function clearAuthSession(): void {
  sessionVersion++;
  accessToken = null;
  refreshToken = null;
  setCurrentUserId(null);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(authSessionStorageKey);
    } catch {
      /* 이미 메모리 세션은 제거됐다. */
    }
  }
}

// 로그인/로그아웃 시 사용자별 화면 상태를 다시 불러와야 한다.
// 화면이 이 변화를 구독할 수 있도록 열어 둔다 (useSyncExternalStore용).
export function subscribeCurrentUserId(listener: (userId: number | null) => void): () => void {
  currentUserListeners.add(listener);
  return () => {
    currentUserListeners.delete(listener);
  };
}

async function responseError(response: Response): Promise<ApiError> {
  const body = await response.text();
  const fallbackMessage =
    response.status === 401
      ? "로그인이 만료되었습니다. 다시 로그인해 주세요."
      : "요청을 처리하지 못했습니다.";
  let message = body.trim() || fallbackMessage;
  let errorCode: string | undefined;

  try {
    const parsed = JSON.parse(body) as { message?: string; errorCode?: string };
    message = parsed.message?.trim() || fallbackMessage;
    errorCode = parsed.errorCode;
  } catch {
    /* plain text response */
  }
  return new ApiError(response.status, message, errorCode);
}

type Renewal = "renewed" | "expired" | "stale";

/**
 * Rotates the refresh token once per session version. `expired` means this session's refresh token was rejected
 * and the session was cleared; `stale` means the session changed meanwhile and the result must not be used.
 */
function renewSession(version: number): Promise<Renewal> {
  if (refreshInFlight?.version === version) return refreshInFlight.promise;
  const promise = rotateRefreshToken(version);
  refreshInFlight = { version, promise };
  void promise
    .finally(() => {
      if (refreshInFlight?.promise === promise) refreshInFlight = null;
    })
    .catch(() => {
      /* 호출한 요청이 오류를 받는다. */
    });
  return promise;
}

async function rotateRefreshToken(version: number): Promise<Renewal> {
  const tokenToRotate = refreshToken;
  const userId = currentUserId;
  if (tokenToRotate == null || userId == null) return "stale";

  // 다른 탭이 이미 회전했다면 회전된 refresh token을 다시 쓰지 않고 그 결과를 사용한다.
  const stored = loadStoredSession();
  if (stored?.userId === userId && stored.refreshToken !== tokenToRotate) {
    accessToken = stored.accessToken;
    refreshToken = stored.refreshToken;
    return "renewed";
  }

  const response = await fetch(`${apiBaseUrl}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken: tokenToRotate }),
    credentials: "omit",
  });
  if (!response.ok) {
    if (response.status === 400 || response.status === 401) {
      if (sessionVersion !== version || refreshToken !== tokenToRotate) return "stale";
      clearAuthSession();
      return "expired";
    }
    // 일시적인 서버 오류는 세션을 유지하고 원 요청에 오류를 돌려준다.
    throw await responseError(response);
  }

  const result = (await response.json()) as Partial<ApiResponse<TokenRefreshResponse>>;
  if (!result.data?.accessToken || !result.data.refreshToken) {
    throw new Error("토큰 갱신 응답이 올바르지 않습니다.");
  }
  if (sessionVersion !== version || refreshToken !== tokenToRotate) return "stale";

  accessToken = result.data.accessToken;
  refreshToken = result.data.refreshToken;
  storeSession({ accessToken, refreshToken, userId });
  return "renewed";
}

/** Resolves a request target and whether it is this app's backend (the only place the session is sent). */
function requestTarget(path: string): { url: string; backendPath: string | null } {
  if (!/^https?:\/\//i.test(path)) return { url: `${apiBaseUrl}${path}`, backendPath: path };
  const base = apiBaseUrl || (typeof window === "undefined" ? "" : window.location.origin);
  try {
    const target = new URL(path);
    return { url: path, backendPath: base && target.origin === new URL(base).origin ? target.pathname : null };
  } catch {
    return { url: path, backendPath: null };
  }
}

/**
 * Sends a request. Backend targets (relative paths, or absolute URLs on the `VITE_API_BASE_URL` origin such as
 * its upload URLs) carry the stored bearer session; other origins never receive it or trigger a refresh.
 */
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const { url, backendPath } = requestTarget(path);
  const requestAccessToken = accessToken;
  const requestSessionVersion = sessionVersion;
  const usesStoredSession =
    backendPath != null &&
    !backendPath.startsWith("/api/v1/auth/") &&
    requestAccessToken != null &&
    !headers.has("Authorization");

  if (init?.body != null && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (usesStoredSession) headers.set("Authorization", `Bearer ${requestAccessToken}`);

  const send = (requestHeaders: Headers) =>
    fetch(url, { ...init, headers: requestHeaders, credentials: init?.credentials ?? "omit" });
  const assertSameSession = () => {
    if (usesStoredSession && sessionVersion !== requestSessionVersion) throw new SessionChangedError();
  };

  let response = await send(headers);
  if (response.status === 401 && usesStoredSession && sessionVersion === requestSessionVersion) {
    const renewal =
      accessToken !== requestAccessToken ? "renewed" : await renewSession(requestSessionVersion);
    // 이 요청의 세션 자체가 만료된 경우에는 원래 401을 그대로 알린다.
    if (renewal === "expired") throw await responseError(response);
    if (renewal === "renewed" && sessionVersion === requestSessionVersion && accessToken) {
      const retryHeaders = new Headers(headers);
      retryHeaders.set("Authorization", `Bearer ${accessToken}`);
      response = await send(retryHeaders);
    }
  }

  if (!response.ok) {
    const error = await responseError(response);
    assertSameSession();
    throw error;
  }
  if (response.status === 204) {
    assertSameSession();
    return undefined as T;
  }
  const body = (await response.json()) as T;
  assertSameSession();
  return body;
}
