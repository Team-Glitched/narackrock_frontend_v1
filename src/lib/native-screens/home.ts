import type { NativeList, NativePost, NativeSong } from "./common.ts";

/** Unfinished work opened on this device; `preview` holds up to 4 tracks of clips as fractions of the arrangement. */
export type NativeWork = {
  id: number;
  shortId: number | null;
  title: string;
  visitedLabel: string | null;
  layerCount: number;
  bpm: number;
  preview: { start: number; length: number }[][];
};

/** The web home page; personal sections are null for guests. */
export type NativeHome = {
  works: { loading: boolean; error: string | null; items: NativeWork[] } | null;
  popular: NativeList<NativeSong>;
  recommended: NativeList<NativeSong>;
  posts: NativeList<NativePost>;
  mine: NativeList<NativeSong> | null;
  minePinnedIds?: number[];
  starBusy?: boolean;
  featuredNotice?: string | null;
};

export type NativeHomeAction =
  | { type: "open-short"; shortId: number }
  | { type: "open-post"; postId: number }
  | { type: "show-songs"; kind: "popular" | "recommended" | "mine" }
  | { type: "resume"; projectId: number; shortId: number | null }
  | { type: "toggle-featured"; shortId: number }
  | { type: "open-posts" | "open-workspace" | "start-song" };
