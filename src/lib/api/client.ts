const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");
let accessTokenProvider: (() => string | null) | null = null;

export function setAccessTokenProvider(provider: (() => string | null) | null) {
  accessTokenProvider = provider;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  if (init?.body != null && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const accessToken = accessTokenProvider?.();
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
