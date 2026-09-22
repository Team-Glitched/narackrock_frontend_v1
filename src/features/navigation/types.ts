export type View =
  | "home"
  | "abyss"
  | "charts"
  | "posts"
  | "post"
  | "social"
  | "search"
  | "opensource"
  | "opensourceDetail"
  | "opensourceComments"
  | "profile"
  | "edit"
  | "studio"
  | "note";

export type Navigate = (view: View) => void;

export const views: View[] = [
  "home",
  "abyss",
  "charts",
  "posts",
  "post",
  "social",
  "search",
  "opensource",
  "opensourceDetail",
  "opensourceComments",
  "profile",
  "edit",
  "studio",
  "note",
];
