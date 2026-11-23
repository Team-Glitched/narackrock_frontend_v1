/** Native screen types of the workspace feature; registered in ./index.ts. */
import type { NativeWork } from "./home.ts";

/** A visited work on /workspace: the home's work card plus the web's "제작한 음악"/"참여한 작업" label. */
export type NativeWorkspaceWork = NativeWork & { label: string };

/** The visited works page (/workspace, the web's WorkspaceScreen). */
export type NativeWorkspace = {
  error: string | null;
  loading: boolean;
  items: NativeWorkspaceWork[];
  /** The web's "더보기" button; disabled while `appending`. */
  hasMore: boolean;
  appending: boolean;
};

export type NativeWorkspaceAction =
  | { type: "start-song" }
  | { type: "resume"; projectId: number; shortId: number | null };

/** Status badge of a contribution request (the web's badgeVariants request/approved/rejected). */
export type NativeRequestStatus = { label: string; tone: "request" | "approved" | "rejected" };

/** A sent contribution request row (/submissions). */
export type NativeSentRequest = {
  contributionId: number;
  projectId: number;
  status: NativeRequestStatus;
  ageLabel: string;
  projectTitle: string;
  description: string | null;
};

/** Sent contribution requests (/submissions, the web's SubmissionsScreen). */
export type NativeSubmissions = {
  /** First load; `failed` is the web's error box (also shown when a next page failed). */
  loading: boolean;
  failed: boolean;
  items: NativeSentRequest[];
  /** A refetch is running; the empty state's "새로고침" is disabled meanwhile. */
  fetching: boolean;
  /** The "더보기" button under the list. */
  paging: { busy: boolean } | null;
};

export type NativeSubmissionsAction =
  | { type: "retry" }
  | { type: "reload" }
  | { type: "open"; contributionId: number; projectId: number };

/** One contribution request (/submissions/:id, the web's SubmissionDetailScreen). */
export type NativeSubmission =
  | { state: "loading"; message: string }
  /** Invalid address, missing project or missing request: a message only. */
  | { state: "invalid"; message: string }
  | { state: "error"; message: string }
  | {
      state: "ready";
      /** "보낸 참여 요청" or "받은 참여 요청". */
      title: string;
      /** "받는 사람" or "보낸 사람". */
      roleLabel: string;
      nickname: string;
      profileImageUrl: string | null;
      ageLabel: string;
      status: NativeRequestStatus;
      projectTitle: string;
      description: string | null;
      rejectReason: string | null;
      projectId: number;
      contributionId: number;
      /** The viewer can approve or reject (reason field and buttons). */
      canReview: boolean;
      reviewBusy: boolean;
      reviewError: string | null;
    };

export type NativeSubmissionAction =
  | { type: "retry" }
  | { type: "resume" }
  | { type: "review"; status: "APPROVED" | "REJECTED"; reason: string };

/** A received contribution request row (/reviews, the web's ContributionRequestCard). */
export type NativeReceivedRequest = {
  contributionId: number;
  projectId: number;
  userId: number;
  nickname: string;
  ageLabel: string;
  projectTitle: string;
  description: string | null;
};

/** Received contribution requests (/reviews, the web's ReviewInboxScreen). */
export type NativeReviews = {
  status: "loading" | "error" | "ready";
  items: NativeReceivedRequest[];
  /** A refetch is running; the empty state's "새로고침" is disabled meanwhile. */
  fetching: boolean;
  reviewBusy: boolean;
  reviewError: string | null;
  /** "참여 요청을 수락했습니다." / "참여 요청을 거절했습니다." */
  notice: string | null;
};

export type NativeReviewsAction =
  | { type: "retry" }
  | { type: "reload" }
  | { type: "open-profile"; userId: number }
  | { type: "open-project"; projectId: number; contributionId: number }
  | { type: "open-details"; contributionId: number; projectId: number }
  | {
      type: "review";
      projectId: number;
      contributionId: number;
      status: "APPROVED" | "REJECTED";
    };

/** Which player of the library an action targets. */
export type NativePlaybackTarget = { kind: "local" | "saved"; id: number };

/** The web's AudioPlaybackBar state; the audio itself plays in the web page. */
export type NativePlayback = {
  label: string;
  playing: boolean;
  loading: boolean;
  muted: boolean;
  /** `reportedPositionMs` (src/lib/playback-progress.ts): stepped while playing and not loading, exact otherwise. */
  positionMs: number;
  durationMs: number | null;
  /** The whole bar is disabled (empty clip). */
  disabled: boolean;
  error: string | null;
};

/** A MIDI work kept on this device (the library's "이 기기의 MIDI 작업"). */
export type NativeLocalResource = {
  id: number;
  title: string;
  description: string;
  saved: boolean;
  /** Null until the page's player reports. */
  player: NativePlayback | null;
};

/** A saved sample of the account's library (the web's SavedOpenSources). */
export type NativeSavedSource = {
  openSourceId: number;
  /** Null when the sample was deleted or made private ("사용할 수 없는 샘플"). */
  source: {
    title: string;
    thumbnailUrl: string | null;
    description: string | null;
    writer: string;
    /** False: "이 샘플은 현재 미리듣기를 사용할 수 없습니다." */
    canPreview: boolean;
    /** Null until the page's player reports. */
    player: NativePlayback | null;
  } | null;
};

/** The account's saved samples; `signed-out` shows the web's sign-in notice. */
export type NativeSavedSources =
  | { state: "signed-out" }
  | { state: "loading" }
  | {
      state: "ready";
      /** Unsave failure. */
      notice: string | null;
      empty: string | null;
      items: NativeSavedSource[];
      /** The sample being unsaved; every unsave button is disabled while any runs or a page loads. */
      unsavingId: number | null;
      locked: boolean;
      error: string | null;
      paging: { label: string; busy: boolean } | null;
    };

/** The sample library (/library, the web's SourceLibraryScreen). */
export type NativeLibrary =
  | {
      view: "library";
      /** The studio's "MIDI 가져오기" (/studio/:projectId/import): local MIDI works only, imported straight into the song. */
      importing: boolean;
      title: string;
      subtitle: string;
      filter: "SERVER" | "LOCAL";
      query: string;
      notice: string | null;
      /** Local MIDI works (LOCAL filter only). */
      local: { items: NativeLocalResource[]; empty: string | null } | null;
      /** Saved samples (SERVER filter only). */
      saved: NativeSavedSources | null;
      /** Resource being imported; every import button is disabled while it runs. */
      busyId: number | null;
    }
  | {
      /** Picking the song a local MIDI work is added to. */
      view: "pick-work";
      subtitle: string;
      error: string | null;
      loading: boolean;
      empty: string | null;
      works: { id: number; title: string; meta: string }[];
      busy: boolean;
      paging: { busy: boolean } | null;
      notice: string | null;
    };

export type NativeLibraryAction =
  | { type: "filter"; filter: "SERVER" | "LOCAL" }
  | { type: "query"; value: string }
  | { type: "toggle-favorite"; id: number }
  | { type: "use"; id: number }
  | { type: "pick"; workId: number }
  | { type: "cancel-pick" }
  | { type: "start-song" }
  | { type: "open-sources" }
  | { type: "open-source"; openSourceId: number }
  | { type: "unsave"; openSourceId: number }
  | { type: "sign-in" }
  | { type: "play"; target: NativePlaybackTarget }
  | { type: "seek"; target: NativePlaybackTarget; ms: number }
  | { type: "mute"; target: NativePlaybackTarget };

export type WorkspaceScreens = {
  "workspace-works": { model: NativeWorkspace; action: NativeWorkspaceAction };
  "workspace-submissions": { model: NativeSubmissions; action: NativeSubmissionsAction };
  "workspace-submission": { model: NativeSubmission; action: NativeSubmissionAction };
  "workspace-reviews": { model: NativeReviews; action: NativeReviewsAction };
  "workspace-library": { model: NativeLibrary; action: NativeLibraryAction };
};
