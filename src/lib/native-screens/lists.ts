import type {
  NativeCommunity,
  NativePagedList,
  NativePerson,
  NativePost,
  NativeSong,
  NativeSourceRow,
} from "./common.ts";

/** A chart row; `star` is the featured-music toggle, null when the viewer cannot set it here. */
export type NativeChartSong = NativeSong & { star: "pinned" | "unpinned" | null };

export type NativeChartTab = "featured" | "authored" | "participated";

/** The charts page (/charts): popular, recommended, or the "내 음악" tabs. */
export type NativeCharts = {
  title: string;
  /** "내 음악" tab; null for the popular/recommended charts. */
  tab: NativeChartTab | null;
  /** Explains the featured-music star when the viewer can set it. */
  hint: string | null;
  /** Error notice above the list (star change failed, next page failed). */
  notice: string | null;
  status: "loading" | "error" | "ready" | "signed-out";
  /** Message of an `error` status, with a "다시 시도" button; null on an error status that the web shows without retry (the popular chart: plain "곡을 불러오지 못했습니다."). */
  error: string | null;
  items: NativeChartSong[];
  emptyMessage: string;
  /** Rows have the share/report menu. */
  menu: boolean;
  /** A star change is saving; stars are disabled meanwhile. */
  starBusy: boolean;
  /** "더보기" under the list; `label` follows the web (retry, expired recommendations…). */
  paging: { label: string; busy: boolean; failure: string | null } | null;
};

export type NativeChartsAction =
  | { type: "tab"; tab: NativeChartTab }
  | { type: "star"; shortId: number }
  | { type: "retry" }
  | { type: "open-short"; shortId: number };

/** The popular posts page (/posts). */
export type NativePostList = {
  title: string;
  list: NativePagedList<NativePost>;
  createLabel: string;
};

export type NativePostListAction = { type: "open-post"; postId: number } | { type: "create" };

export type NativeSearchScope = "sources" | "songs" | "people" | "posts" | "communities";

/** The search page (/search). */
export type NativeSearch = {
  query: string;
  scope: NativeSearchScope;
  /** Name of the community searched inside; no scope tabs then. */
  community: string | null;
  placeholder: string;
  /** Hint before typing, sign-in requirement, or an error (with retry). */
  message: { text: string; tone: "muted" | "error"; retry: boolean; signIn: boolean } | null;
  searching: boolean;
  /** Results of the current scope; only that scope's list is filled. */
  results: {
    posts: NativePost[];
    communities: NativeCommunity[];
    songs: NativeSong[];
    sources: NativeSourceRow[];
    people: NativePerson[];
  } | null;
  empty: boolean;
  /** People and songs load page by page. */
  paging: { busy: boolean; failed: boolean } | null;
};

export type NativeSearchAction =
  | { type: "query"; value: string }
  | { type: "scope"; scope: NativeSearchScope }
  | { type: "retry" }
  /** The sign-in button: the web's requestLogin() confirmation. */
  | { type: "sign-in" }
  | { type: "open-post"; postId: number }
  | { type: "open-community"; galleryId: number }
  | { type: "toggle-join"; galleryId: number }
  | { type: "open-short"; shortId: number }
  | { type: "open-source"; openSourceId: number }
  | { type: "open-profile"; userId: number };
