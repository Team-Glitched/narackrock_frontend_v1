const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> { const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers: { "Content-Type": "application/json", ...init?.headers }, credentials: "include" }); if (!response.ok) throw new ApiError(response.status, await response.text()); return response.json() as Promise<T>; }
