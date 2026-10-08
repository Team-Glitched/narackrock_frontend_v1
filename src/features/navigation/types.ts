export type View =
  | "home" | "abyss" | "charts" | "posts" | "friends" | "search"
  | "community" | "joined" | "profile" | "edit" | "studio" | "note"
  | "social" | "opensource" | "opensourceDetail" | "opensourceComments"
  | "login" | "choose" | "upload" | "record" | "notifications";

export type Navigate = (view: View) => void;

export const views: View[] = [
  "home", "abyss", "charts", "posts", "friends", "search",
  "community", "joined", "profile", "edit", "studio", "note", "login",
  "social", "opensource", "opensourceDetail", "opensourceComments",
  "choose", "upload", "record", "notifications",
];
