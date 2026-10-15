export type SharedContent = { kind: "post" | "short"; id: number };

export function contentLink({ kind, id }: SharedContent): string {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("유효하지 않은 콘텐츠 ID입니다.");
  return `https://narackrock.com/${kind}s/${id}`;
}

export function parseContentLink(pathname: string, search = ""): SharedContent | null {
  const path = /^\/(posts|shorts)\/([1-9]\d*)\/?$/.exec(pathname);
  if (path) {
    const id = Number(path[2]);
    return Number.isSafeInteger(id) ? { kind: path[1] === "posts" ? "post" : "short", id } : null;
  }
  if (pathname !== "/") return null;
  const params = new URLSearchParams(search);
  for (const kind of ["post", "short"] as const) {
    const raw = params.get(kind);
    if (!raw || !/^[1-9]\d*$/.test(raw)) continue;
    const id = Number(raw);
    if (Number.isSafeInteger(id)) return { kind, id };
  }
  return null;
}
