export type View =
  | "workspace" | "submissions" | "submissionDetail" | "reviewInbox" | "sourceLibrary" | "importSource"
  | "createPost" | "createCommunity" | "createSource"
  | "home" | "abyss" | "charts" | "posts" | "friends" | "search"
  | "community" | "joined" | "profile" | "edit" | "studio" | "note"
  | "chat" | "social" | "opensource" | "opensourceDetail" | "opensourceComments"
  | "settings" | "saved" | "admin" | "communityAdmin" | "login" | "choose" | "upload" | "record" | "notifications";

export type Navigate = (view: View, profileUserId?: number) => void;

export const views: View[] = [
  "workspace", "submissions", "submissionDetail", "reviewInbox", "sourceLibrary", "importSource",
  "createPost", "createCommunity", "createSource",
  "home", "abyss", "charts", "posts", "friends", "search",
  "community", "joined", "profile", "edit", "studio", "note", "login",
  "chat", "social", "opensource", "opensourceDetail", "opensourceComments",
  "choose", "upload", "record", "notifications", "settings", "saved", "admin", "communityAdmin",
];
