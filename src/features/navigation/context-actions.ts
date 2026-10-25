import type { View } from "./types";
export type SearchScope = "sources"|"songs"|"people"|"posts"|"communities";
export type CreationKind = "post"|"community"|"source"|"song"|"friend";
export function screenScope(view:View,tab:"posts"|"community"|"friends",insideCommunity=false):SearchScope {
  if(insideCommunity||view==="posts"||view==="communityAdmin")return "posts";
  if(view==="joined"||view==="community")return "communities";
  if(view==="social")return tab==="community"?"communities":tab==="friends"?"people":"posts";
  if(view==="friends"||view==="profile"||view==="edit")return "people";
  if(view==="sourceLibrary"||view==="importSource")return "sources";
  if(view.startsWith("opensource"))return "sources";
  return "songs";
}
export function creationForScope(scope:SearchScope):CreationKind {
  return {posts:"post",communities:"community",people:"friend",sources:"source",songs:"song"}[scope] as CreationKind;
}

export function creationForView(view: View, scope: SearchScope): CreationKind {
  return view === "profile" || view === "edit" ? "song" : creationForScope(scope);
}
export const creationLabels: Record<CreationKind, string> = { post: "게시글 작성", community: "커뮤니티 생성", source: "오픈소스 생성", song: "곡 만들기", friend: "친구 찾기" };
