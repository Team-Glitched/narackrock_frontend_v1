/** Native screen types of the sources feature; registered in ./index.ts. */
import type { NativeCommentAction, NativeComments } from "./comments.ts";
import type { NativeLibraryAction, NativePlayback, NativeSavedSources } from "./workspace.ts";

export type NativeSourceWriter = {
  userId: number;
  nickname: string;
  profileImageUrl: string | null;
};

/**
 * A sample card of the 탐색 tab (the web's OpenSourceCard). One sample can show in several sections,
 * each card with its own save button and player: `key` names this card in actions.
 */
export type NativeSourceCard = {
  key: string;
  openSourceId: number;
  title: string;
  thumbnailUrl: string | null;
  /** "사용 수 1,234"; null when the server does not report it. */
  usage: string | null;
  description: string;
  writer: NativeSourceWriter;
  likeCount: number;
  dislikeCount: number;
  vote: "like" | "dislike" | null;
  commentCount: number;
  saved: boolean;
  /** A save/unsave of this card is being sent (its button is disabled). */
  saveBusy: boolean;
  saveError: string | null;
  /** False: "이 샘플은 현재 미리듣기를 사용할 수 없습니다." */
  canPreview: boolean;
  /** Null until the page's player reports. */
  player: NativePlayback | null;
};

/** A swipeable rail of the 탐색 tab ("인기 샘플", "추천 샘플"). */
export type NativeSourceRail = {
  title: string;
  /** Null while loading ("샘플을 불러오는 중...") or failed (`error` with "다시 시도"). */
  items: NativeSourceCard[] | null;
  error: string | null;
};

/** The 탐색 tab (the web's OpensourceScreen). */
export type NativeSourceFeed =
  | { state: "signed-out" }
  | {
      state: "ready";
      popular: NativeSourceRail;
      recommended: NativeSourceRail;
      /** "전체 샘플". */
      all: {
        loading: boolean;
        error: string | null;
        /** "아직 공개된 샘플이 없습니다." */
        empty: boolean;
        items: NativeSourceCard[];
        /** The "더보기" button. */
        more: { busy: boolean } | null;
      };
    };

/** A row of 내 등록 (the web's SourcePublications). */
export type NativeSourcePublication = {
  openSourceId: number;
  title: string;
  description: string | null;
  public: boolean;
  /** "관리" is loading this sample's metadata ("불러오는 중..."). */
  managing: boolean;
  /** Its visibility is being changed ("변경 중..."). */
  switching: boolean;
};

/** The 내 등록 tab: the owner's samples, or the 등록 관리 form of one of them. */
export type NativeSourcePublications =
  | { state: "signed-out" }
  | {
      state: "list";
      notice: string | null;
      /** "내 등록 샘플을 불러오는 중..." */
      loading: boolean;
      /** Load failure with "다시 시도". */
      error: string | null;
      /** "아직 등록한 샘플이 없습니다." */
      empty: boolean;
      items: NativeSourcePublication[];
      /** A write runs: every row button is disabled. */
      locked: boolean;
      /** The list is fetching: 관리, 공개 전환, 다시 시도 and 더보기 are disabled. */
      fetching: boolean;
      /** The "더보기" button ("불러오는 중..." while `loading`). */
      more: boolean;
    }
  | {
      state: "editor";
      notice: string | null;
      /** The edited sample; the app resets its fields when it changes. */
      openSourceId: number;
      public: boolean;
      title: string;
      description: string;
      thumbnail: "keep" | "replace" | "remove";
      /** The sample has a thumbnail ("현재 썸네일 유지" without "(없음)"). */
      hasThumbnail: boolean;
      /** "선택한 이미지: {name}". */
      fileName: string | null;
      error: string | null;
      /** A write runs: the fields and buttons are disabled. */
      locked: boolean;
      /** "저장 중...". */
      saving: boolean;
      /** The "샘플을 삭제할까요?" confirmation of the sample `title` (`error`: the last delete failure). */
      confirmDelete: { title: string; error: string | null } | null;
      /** "삭제 중...". */
      deleting: boolean;
    };

/** /sources (the web's SourcesPage): the 탐색, 보관함 and 내 등록 tabs. */
export type NativeSources = {
  tab: "feed" | "saved" | "mine";
  feed: NativeSourceFeed | null;
  /** "샘플 보관함", drawn like the library's saved samples. */
  saved: NativeSavedSources | null;
  mine: NativeSourcePublications | null;
  /** The floating "만들기" button (not on 보관함). */
  create: boolean;
};

export type NativeSourcesAction =
  | { type: "sources-home" }
  | { type: "sources-tab"; tab: NativeSources["tab"] }
  | { type: "sources-create" }
  | { type: "sources-open"; openSourceId: number; comments?: boolean }
  | { type: "sources-profile"; userId: number }
  | { type: "sources-rail-retry"; rail: "popular" | "recommended" }
  | { type: "sources-save"; key: string }
  | { type: "sources-play"; key: string }
  | { type: "sources-seek"; key: string; ms: number }
  | { type: "sources-mute"; key: string }
  | { type: "sources-manage"; openSourceId: number }
  | { type: "sources-visibility"; openSourceId: number }
  /** 내 등록's "다시 시도" and "더보기". */
  | { type: "sources-publications-page" }
  | { type: "sources-editor-title" | "sources-editor-description"; value: string }
  | { type: "sources-editor-thumbnail"; thumbnail: "keep" | "replace" | "remove" }
  | { type: "sources-editor-pick" }
  | { type: "sources-editor-save" | "sources-editor-close" }
  | { type: "sources-delete-open" | "sources-delete-cancel" | "sources-delete-confirm" }
  /** The saved samples (shared with the library screen); `play`/`seek`/`mute` target `saved` players. */
  | Extract<
      NativeLibraryAction,
      { type: "unsave" | "open-source" | "sign-in" | "play" | "seek" | "mute" }
    >;

/** /sources/:id and /sources/:id/comments (the web's OpensourceDetailScreen). */
export type NativeSourceDetail =
  | { state: "invalid" | "signed-out" | "loading" }
  | { state: "error"; message: string }
  | {
      state: "ready";
      source: {
        openSourceId: number;
        title: string;
        thumbnailUrl: string | null;
        usage: string | null;
        description: string;
        writer: NativeSourceWriter;
        likeCount: number;
        dislikeCount: number;
        commentCount: number;
        vote: "like" | "dislike" | null;
        saved: boolean;
        canPreview: boolean;
      };
      saveBusy: boolean;
      saveError: string | null;
      /** A reaction or save is being sent: the reaction and save buttons are disabled. */
      busy: boolean;
      /** Reaction/share result ("링크를 복사했습니다.", failures). */
      notice: string | null;
      /** Null until the page's player reports (or when previews are unavailable). */
      player: NativePlayback | null;
      comments: NativeComments;
      /** Opened as /comments: the comment input takes focus once shown. */
      openComments: boolean;
    };

export type NativeSourceDetailAction =
  | { type: "source-retry" }
  | { type: "source-vote"; vote: "like" | "dislike" }
  | { type: "source-save" }
  | { type: "source-share" }
  | { type: "source-comments" }
  | { type: "source-profile"; userId: number }
  | { type: "source-play" | "source-mute" }
  | { type: "source-seek"; ms: number }
  | { type: "sign-in" }
  | NativeCommentAction;

/** The thumbnail framing (src/features/sources/thumbnail-crop.ts ThumbnailCrop). */
export type NativeThumbnailCrop = { zoom: number; x: number; y: number };

/** /sources/new (the web's SocialCreate kind "source", details step). */
export type NativeSourceCreate =
  | { state: "signed-out" | "restoring" | "expired" }
  | {
      state: "form";
      title: string;
      description: string;
      /** The "오디오" button: none ("오디오 추가"), chosen, or the uploaded audio of a retried publication. */
      audio: "none" | "selected" | "locked";
      /**
       * The album picture: a downscaled preview for the crop editor (`failed` when it cannot be
       * decoded: "앨범 이미지를 미리 볼 수 없습니다...").
       */
      image:
        | { status: "loading" | "failed" }
        | { status: "ready"; uri: string; width: number; height: number }
        | null;
      crop: NativeThumbnailCrop;
      /** The crop editor ("앨범" sheet) is open: after picking a picture and on "앨범 이미지 편집". */
      cropping: boolean;
      visibility: "PUBLIC" | "PRIVATE";
      busy: boolean;
      error: string | null;
      storageError: string | null;
      restoreError: string | null;
      /** "앨범 이미지를 복원하지 못했습니다..." with "앨범 이미지 없이 등록". */
      imageRestoreFailed: boolean;
      draftStatus: string;
      canSubmit: boolean;
      submitLabel: string;
    };

export type NativeSourceCreateAction =
  | { type: "source-create-title" | "source-create-description"; value: string }
  | { type: "source-create-audio" }
  | { type: "source-create-image" }
  | { type: "source-create-remove-image" }
  | { type: "source-create-edit-image" }
  /** The crop after a drag or zoom in the "앨범" sheet (the web's ThumbnailCropper `onChange`). */
  | { type: "source-create-crop"; crop: NativeThumbnailCrop }
  /** "완료" (or closing) the "앨범" sheet. */
  | { type: "source-create-crop-done" }
  | { type: "source-create-visibility"; visibility: "PUBLIC" | "PRIVATE" }
  | { type: "source-create-keep-without-image" }
  | { type: "source-create-submit" }
  | { type: "source-create-discard" }
  | { type: "sign-in" };

export type SourcesScreens = {
  sources: { model: NativeSources; action: NativeSourcesAction };
  "source-detail": { model: NativeSourceDetail; action: NativeSourceDetailAction };
  "source-create": { model: NativeSourceCreate; action: NativeSourceCreateAction };
};
