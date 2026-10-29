import type { View } from "./types.ts";

export type PageRoute = {
  id: string;
  path: string;
  view: View;
  title?: string;
  layout?: "studio";
  hideHeader?: boolean;
  hideFooter?: boolean;
  back?: string;
  requiresAuth?: boolean;
};

export const pageRoutes = [
  { id: "home", path: "", view: "home" },
  { id: "abyss", path: "abyss", view: "abyss", back: "/" },
  { id: "short", path: "abyss/:shortId", view: "abyss", back: "/" },
  { id: "charts", path: "charts", view: "charts", back: "/" },
  { id: "posts", path: "posts", view: "posts", back: "/" },
  { id: "post", path: "posts/:postId", view: "posts", hideFooter: true, back: "/posts" },
  { id: "createPost", path: "posts/new", view: "createPost", hideFooter: true, back: "/social" },
  { id: "social", path: "social", view: "social" },
  { id: "communities", path: "communities", view: "community" },
  { id: "friends", path: "friends", view: "friends" },
  { id: "joined", path: "communities/joined", view: "joined", back: "/communities" },
  { id: "createCommunity", path: "communities/new", view: "createCommunity", hideFooter: true, back: "/communities" },
  { id: "community", path: "communities/:galleryId", view: "community", back: "/communities" },
  { id: "communityPost", path: "communities/:galleryId/posts/:postId", view: "community", hideFooter: true, back: "/communities" },
  { id: "communityAdmin", path: "communities/:galleryId/manage", view: "communityAdmin", back: "/communities" },
  { id: "communityMembers", path: "communities/:galleryId/members", view: "communityAdmin", hideHeader: true, back: "/communities" },
  { id: "ownedCommunities", path: "communities/manage", view: "communityAdmin", back: "/communities" },
  { id: "sources", path: "sources", view: "opensource" },
  { id: "source", path: "sources/:sourceId", view: "opensourceDetail", back: "/sources" },
  { id: "sourceComments", path: "sources/:sourceId/comments", view: "opensourceComments", back: "/sources" },
  { id: "createSource", path: "sources/new", view: "createSource", hideFooter: true, back: "/sources" },
  { id: "search", path: "search", view: "search", hideHeader: true, back: "/" },
  { id: "profile", path: "profile", view: "profile", requiresAuth: true, back: "/" },
  { id: "user", path: "users/:userId", view: "profile", back: "/" },
  { id: "editProfile", path: "profile/edit", view: "edit", requiresAuth: true, back: "/profile" },
  { id: "login", path: "login", view: "login", hideHeader: true, hideFooter: true },
  { id: "onboarding", path: "onboarding", view: "edit", hideHeader: true, hideFooter: true },
  { id: "settings", path: "settings", view: "settings", back: "/profile" },
  { id: "saved", path: "saved", view: "saved", back: "/settings" },
  { id: "workspace", path: "workspace", view: "workspace", back: "/settings" },
  { id: "submissions", path: "submissions", view: "submissions", back: "/settings" },
  { id: "submission", path: "submissions/:submissionId", view: "submissionDetail", back: "/submissions" },
  { id: "reviews", path: "reviews", view: "reviewInbox", back: "/settings" },
  { id: "library", path: "library", view: "sourceLibrary", back: "/settings" },
  { id: "studioNew", path: "studio/new", view: "studio", hideFooter: true, back: "/" },
  { id: "studio", path: "studio/:projectId", view: "studio", layout: "studio", back: "/" },
  { id: "joinShort", path: "studio/shorts/:shortId", view: "studio", layout: "studio", back: "/abyss" },
  { id: "choose", path: "studio/:projectId/layers/new", view: "choose", back: "/studio/new" },
  { id: "upload", path: "studio/:projectId/upload", view: "upload", back: "/studio/new" },
  { id: "record", path: "studio/:projectId/record", view: "record", back: "/studio/new" },
  { id: "notes", path: "studio/:projectId/tracks/:trackId/notes", view: "note", layout: "studio", back: "/studio/new" },
  { id: "import", path: "studio/:projectId/import", view: "importSource", back: "/studio/new" },
  { id: "chat", path: "chat", view: "chat", hideHeader: true, hideFooter: true, back: "/friends" },
  { id: "notifications", path: "notifications", view: "notifications", hideFooter: true, back: "/" },
  { id: "admin", path: "admin", view: "admin", back: "/settings" },
] as const satisfies readonly PageRoute[];

export type PageId = (typeof pageRoutes)[number]["id"];
