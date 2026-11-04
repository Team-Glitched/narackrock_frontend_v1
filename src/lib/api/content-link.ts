export type SharedContentKind = "short" | "post" | "source";

const appPaths: Record<SharedContentKind, (id: number) => string> = {
  short: (id) => `/abyss/${id}`,
  post: (id) => `/posts/${id}`,
  source: (id) => `/sources/${id}`,
};

/**
 * Turns a backend share URL into this app's canonical link. Backend share bases are environment settings and
 * may point at a legacy route (`/shorts/:id`, `/opensource/:id`); the link is accepted only when it names the
 * same entity, and is then rebuilt on the current origin's app route.
 */
export function canonicalShareLink(kind: SharedContentKind, id: number, shareUrl: string, origin: string): string {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("유효하지 않은 콘텐츠 ID입니다.");
  let parsed: URL;
  try {
    parsed = new URL(shareUrl);
  } catch {
    throw new Error("서버가 올바르지 않은 공유 링크를 보냈습니다.");
  }
  const lastSegment = parsed.pathname.replace(/\/+$/, "").split("/").pop();
  if (!/^https?:$/.test(parsed.protocol) || lastSegment !== String(id))
    throw new Error("서버가 다른 콘텐츠의 공유 링크를 보냈습니다.");
  return `${origin}${appPaths[kind](id)}`;
}
