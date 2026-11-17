/** Native screen types of the abyss feature; registered in ./index.ts. */
import type { NativeCommentAction, NativeComments } from "./comments.ts";

/** One cover of the album carousel. `albumImageUrl` null: the default shortform cover. */
export type NativeAbyssCover = { shortId: number; title: string; albumImageUrl: string | null };

/** The listened short (the web AbyssScreen's title block and PostActions). */
export type NativeAbyssShort = NativeAbyssCover & {
  author: { userId: number; nickname: string };
  likeCount: number;
  dislikeCount: number;
  commentCount: number;
  vote: "like" | "dislike" | null;
  saved: boolean;
};

/**
 * The player of the current short; the audio (original `<audio>` or the owner-subset composition)
 * plays in the web page. `positionMs` is rounded down to 250 ms so playback does not resend the
 * model on every time update.
 */
export type NativeAbyssPlayback = {
  playing: boolean;
  /** The play/pause button is enabled. */
  canPlay: boolean;
  positionMs: number;
  /** 0 until the length is known (the seek bar is disabled). */
  totalMs: number;
};

/** One owner row of the participant sheet (signed in). */
export type NativeAbyssOwner = {
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
  /** "원곡자" / "작곡 참여자", roles and track names joined by " · ". */
  detail: string;
  checked: boolean;
};

/** The participant sheet (the web's ShortParticipants). */
export type NativeAbyssParticipants =
  | {
      signedIn: false;
      /** The short's participants; `role` is "원곡자" or "작곡 참여자". */
      people: { userId: number; nickname: string; role: string }[];
    }
  | {
      signedIn: true;
      /** The stems loaded: checkboxes, 전체 선택 and 해제 are enabled. */
      selectable: boolean;
      /** Stems line: loading, the selection, or the stems error (with "다시 시도"). */
      stems: { text: string; error: boolean };
      composersLoading: boolean;
      /** Composer load failure, with "다시 시도". */
      composersError: string | null;
      owners: NativeAbyssOwner[];
      /** "아직 참여자가 없습니다." */
      empty: boolean;
    };

/** A sheet over the short: the web opens these as bottom sheets. */
export type NativeAbyssSheet =
  | { kind: "comments"; comments: NativeComments }
  | { kind: "participants"; participants: NativeAbyssParticipants };

export type NativeAbyssReady = {
  status: "ready";
  short: NativeAbyssShort;
  /** Covers next to the current one in the loaded list (none at the ends). */
  previous: NativeAbyssCover | null;
  next: NativeAbyssCover | null;
  /** 1-based position in the loaded list and its length (the carousel's live label). */
  position: number;
  count: number;
  /** The previous button is enabled (it wraps to the last short at the start). */
  canPrevious: boolean;
  /** The next button is enabled (the feed never ends; disabled while the next page loads). */
  canNext: boolean;
  playback: NativeAbyssPlayback;
  /** Lines under the player, in the web's order (selection, missing/failed audio, playback error). */
  messages: { text: string; alert: boolean }[];
  /** "다음 숏폼을 불러오지 못했습니다." with "다시 시도". */
  nextFailed: boolean;
  /** A reaction, save or share is being sent. */
  busy: boolean;
  /** Result of the last share or action failure. */
  feedback: string | null;
  /** The participation button under the player; `secondary` for owner/contributor/pending. */
  join: { label: string; secondary: boolean; busy: boolean } | null;
  /** The open sheet; null while closed or a web modal (login prompt, report sheet) is open. */
  sheet: NativeAbyssSheet | null;
};

/** The abyss page (/abyss, /abyss/:shortId): one short of the feed at a time. */
export type NativeAbyss =
  | {
      /** invalid: "올바르지 않은 페이지 주소입니다."; error: retry; empty: no public shorts. */
      status: "invalid" | "loading" | "error" | "empty";
    }
  | NativeAbyssReady;

export type NativeAbyssAction =
  | { type: "abyss-retry" }
  | { type: "abyss-previous" }
  | { type: "abyss-next" }
  | { type: "abyss-toggle" }
  | { type: "abyss-seek"; ms: number }
  | { type: "abyss-vote"; vote: "like" | "dislike" }
  | { type: "abyss-save" }
  | { type: "abyss-share" }
  | { type: "abyss-report" }
  | { type: "abyss-profile"; userId: number }
  | { type: "abyss-join" }
  | { type: "abyss-comments" }
  | { type: "abyss-participants" }
  /** Grip/backdrop: closes the sheet; the participant sheet applies its selection. */
  | { type: "abyss-close-sheet" }
  | {
      type: "abyss-participants-op";
      op:
        | "select-all"
        | "clear"
        | "listen-all"
        | "confirm"
        | "retry-stems"
        | "retry-composers"
        | "login";
    }
  | { type: "abyss-participant-toggle"; userId: number }
  | NativeCommentAction;

export type AbyssScreens = {
  abyss: { model: NativeAbyss; action: NativeAbyssAction };
};
