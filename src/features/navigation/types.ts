export type View =
  | "home" | "abyss" | "charts" | "posts" | "friends" | "search"
  | "community" | "profile" | "edit" | "studio" | "note"
  | "choose" | "upload" | "record" | "notifications";

export type Navigate = (view: View) => void;

export const views: View[] = [
  "home", "abyss", "charts", "posts", "friends", "search",
  "community", "profile", "edit", "studio", "note", "choose", "upload", "record", "notifications",
];
