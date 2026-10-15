export type SharedContent = { kind: "post" | "short"; id: number };

export function contentLink({ kind, id }: SharedContent): string {
  if (!Number.isSafeInteger(id) || id < 1) throw new Error("유효하지 않은 콘텐츠 ID입니다.");
  const url = new URL("https://narackrock.com/");
  url.searchParams.set(kind, String(id));
  return url.toString();
}

export function parseContentLink(search: string): SharedContent | null {
  const params = new URLSearchParams(search);
  for (const kind of ["post", "short"] as const) {
    const raw = params.get(kind);
    if (!raw || !/^[1-9]\d*$/.test(raw)) continue;
    const id = Number(raw);
    if (Number.isSafeInteger(id)) return { kind, id };
  }
  return null;
}
