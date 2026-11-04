export function readId(value: string | null | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function safeReturnPath(value: unknown, fallback = "/"): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  )
    return fallback;
  const url = new URL(value, "https://narackrock.local");
  if (url.origin !== "https://narackrock.local" || url.pathname.startsWith("//")) return fallback;
  return url.pathname + url.search + url.hash;
}

export function withQuery(
  path: string,
  values: Record<string, string | number | null | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value != null && value !== "") query.set(key, String(value));
  return query.size ? `${path}?${query}` : path;
}

export function studioPath(projectId: number, shortId?: number | null): string {
  return withQuery(`/studio/${projectId}`, { shortId });
}

export function notesPath(
  projectId: number,
  trackId: number,
  clipId?: number | null,
  shortId?: number | null,
): string {
  return withQuery(`/studio/${projectId}/tracks/${trackId}/notes`, { clipId, shortId });
}

