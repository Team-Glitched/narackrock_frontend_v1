/** Native screen types of the post feature; registered in ./index.ts. */
import type { NativeCommentAction, NativeComments } from "./comments.ts";

export type * from "./comments.ts";

/** A post page (/posts/:postId, /communities/:galleryId/posts/:postId): the post and its comments. */
export type NativePostDetail = {
  /** "올바르지 않은 페이지 주소입니다." for a malformed address; nothing else is shown then. */
  invalid: boolean;
  /** Load or delete failure; `retry` when the post itself could not be loaded. */
  error: string | null;
  retry: boolean;
  /** Result of a member sanction. */
  notice: string | null;
  post: {
    postId: number;
    title: string;
    content: string;
    imageUrl: string | null;
    writer: { userId: number; nickname: string; profileImageUrl: string | null };
    /** The post's community (the feed card's PostCommunityLabel), null when unnamed. */
    community: string | null;
    createdLabel: string;
    likeCount: number;
    dislikeCount: number;
    commentCount: number;
    vote: "like" | "dislike" | null;
    saved: boolean;
  } | null;
  /** A reaction, save or share is being sent; the controls are disabled. */
  busy: boolean;
  /** Reaction/save/share result or failure (the web's status line under the actions). */
  interactionNotice: string | null;
  /** "게시글 더보기" menu: 신고 and 숨기기 always, the moderator's delete and member sanctions when allowed. */
  menu: { moderate: boolean; sanction: boolean };
  /** The moderator's delete confirmation (with a reason) is open. */
  confirmDelete: boolean;
  deleting: boolean;
  comments: NativeComments;
};

export type NativePostDetailAction =
  | { type: "post-retry" | "post-save" | "post-share" | "post-hide" | "post-report" }
  | { type: "post-vote"; vote: "like" | "dislike" }
  /** The comment button: focuses the composer after the login check. */
  | { type: "post-comments" }
  | { type: "post-delete-open" | "post-delete-cancel" }
  | { type: "post-delete"; reason: string }
  | { type: "post-sanction"; action: "suspend" | "expel" }
  | { type: "open-profile"; userId: number }
  | NativeCommentAction;

/** A community the new post can go to (the web's PostCommunityPicker rows). */
export type NativePostTarget = {
  galleryId: number;
  name: string;
  description: string;
  imageUrl: string | null;
  /** "가입자 N명" */
  memberLabel: string;
};

/** The create post page (/posts/new, optionally ?galleryId=). */
export type NativePostCreate = {
  /** "작성 중인 내용을 불러오는 중..." while the draft is restored; the fields are not shown yet. */
  restoring: boolean;
  /** The fields' values; the app starts from them and sends every change back. */
  title: string;
  content: string;
  /** A small preview (data URL) of the attached picture, null while it is prepared. */
  image: { preview: string | null } | null;
  busy: boolean;
  error: string | null;
  storageError: string | null;
  restoreError: string | null;
  /** Draft save line (초안을 저장하는 중... / ...). */
  draftStatus: string;
  /** Why the post cannot be sent to the chosen community yet. */
  targetNotice: { text: string; tone: "status" | "alert" } | null;
  canSubmit: boolean;
  submitLabel: string;
  /** The header's community picker. */
  communities: {
    status: "loading" | "error" | "ready";
    items: NativePostTarget[];
    selectedId: number;
    selectedName: string | null;
  };
};

export type NativePostCreateAction =
  | { type: "post-create-title" | "post-create-content"; value: string }
  | { type: "post-create-image" | "post-create-remove-image" }
  | { type: "post-create-submit" | "post-create-discard" }
  | { type: "post-create-community"; galleryId: number }
  | { type: "post-create-communities-retry" };

export type PostScreens = {
  "post-detail": { model: NativePostDetail; action: NativePostDetailAction };
  "post-create": { model: NativePostCreate; action: NativePostCreateAction };
};
