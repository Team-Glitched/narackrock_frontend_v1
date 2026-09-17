const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }

// 로그인 세션 동안만 유지하는 액세스 토큰. 이 프런트는 아직 임시 화면이라 새로고침 시 유지는 하지 않는다.
let accessToken: string | null = null;
export function setAccessToken(token: string | null): void { accessToken = token; }
export function getAccessToken(): string | null { return accessToken; }

// 내 글/댓글인지 판별하려면 응답의 writer.userId와 비교할 로그인 사용자 id가 필요하다.
// 로그인 응답에만 담겨 오므로 토큰과 함께 보관한다.
let currentUserId: number | null = null;
export function setCurrentUserId(userId: number | null): void { currentUserId = userId; }
export function getCurrentUserId(): number | null { return currentUserId; }

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init?.headers as Record<string, string> | undefined) };
  if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
  // 백엔드는 쿠키가 아니라 Authorization 헤더 기반 stateless 인증을 쓴다(docs/AGENTS.md 참고) — credentials: "include"는
  // 불필요하고, 서버의 CORS 설정이 Access-Control-Allow-Credentials를 내려주지 않아 브라우저에서 프리플라이트가 막힌다.
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  if (!response.ok) throw new ApiError(response.status, await response.text());
  return response.json() as Promise<T>;
}
