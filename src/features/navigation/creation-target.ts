import type { SearchScope } from "@/features/search/search-scope";
import { withQuery } from "./paths";
export function creationTarget(scope: SearchScope, galleryId?: number | null): { path: string; label: string } {
  switch (scope) {
    case "songs": return { path: "/studio/new", label: "곡 만들기" };
    case "people": return { path: "/search?scope=people", label: "친구 찾기" };
    case "posts": return { path: withQuery("/posts/new", { galleryId }), label: "게시글 작성" };
    case "communities": return { path: "/communities/new", label: "커뮤니티 생성" };
    case "sources": return { path: "/sources/new", label: "오픈소스 생성" };
  }
}
