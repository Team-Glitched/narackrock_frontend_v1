import { useCallback, useEffect, useRef, useState } from "react";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import { nativePost } from "@/features/navigation/native-models";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import type { UserProfile } from "@/lib/api/contracts";
import { pickNativeImage } from "@/lib/native-app";
import type {
  NativeEditProfile,
  NativeLikedPosts,
  NativeProfile,
  NativeProfileList,
  NativeProfileRelation,
  NativeProfileWorks,
} from "@/lib/native-screens";
import { uiLabels } from "@/lib/ui-labels";
import { useLikedPosts } from "./liked-posts-screen";
import { useProfileList, type ProfileListKind } from "./profile-lists";
import { useProfilePrivacy, useProfileRelation } from "./profile-relations";
import {
  compactCount,
  featuredChartPath,
  featuredSongs,
  profileInstruments,
  useOwnProfile,
  useOwnWorks,
  useProfileForm,
  useSaveProfile,
} from "./profile-screens";

/**
 * Hands a child's model and controls to the screen bridge. Profile-dependent hooks live in children
 * mounted only when they apply (as on the web), so the bridge keeps one native screen throughout.
 */
function useLifted<M, C>() {
  const [model, setModel] = useState<M | null>(null);
  const controls = useRef<C | null>(null);
  const lift = useCallback((next: M | null, nextControls: C | null) => {
    controls.current = nextControls;
    setModel((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
  }, []);
  return { model, controls, lift };
}

/** Reports a child's model up on every render; clears it on unmount. */
function useLift<M, C>(model: M, controls: C, lift: (model: M | null, controls: C | null) => void) {
  useEffect(() => lift(model, controls));
  useEffect(() => () => lift(null, null), [lift]);
}

type RelationControls = { change: () => void; recheck: () => void; chat: () => void };

function RelationModel({
  profile,
  onChat,
  lift,
}: {
  profile: UserProfile;
  onChat: (userId: number) => void;
  lift: (model: NativeProfileRelation | null, controls: RelationControls | null) => void;
}) {
  const relation = useProfileRelation(profile);
  useLift<NativeProfileRelation, RelationControls>(
    {
      label: relation.label,
      tone: relation.tone,
      disabled: relation.disabled,
      pressed: relation.pressed ?? null,
      checkError: relation.outgoingError || null,
      chat: relation.canChat,
      notice: relation.notice || null,
    },
    { change: relation.change, recheck: relation.recheck, chat: () => relation.chat(onChat) },
    lift,
  );
  return null;
}

type WorksControls = { retry: () => void; paths: Record<string, string> };

function OwnWorksModel({
  lift,
}: {
  lift: (model: NativeProfileWorks[] | null, controls: WorksControls | null) => void;
}) {
  const { songs, sections } = useOwnWorks();
  useLift<NativeProfileWorks[], WorksControls>(
    sections.map((section) => ({
      key: section.tab,
      title: section.title,
      status: songs.status === "signed-out" ? "ready" : songs.status,
      error: songs.status === "error" ? songs.error : null,
      songs: section.items.map(({ shortId, title, albumImageUrl }) => ({
        shortId,
        title,
        albumImageUrl,
      })),
      // The web shows no message while signed out (the page itself asks to sign in).
      emptyMessage: songs.status === "ready" ? section.emptyMessage : "",
      all: "chart",
    })),
    {
      retry: songs.retry,
      paths: Object.fromEntries(sections.map((section) => [section.tab, section.allPath])),
    },
    lift,
  );
  return null;
}

type ListControls = {
  retry: () => void;
  retryMutual: () => void;
  setFilter: (filter: "all" | "mutual") => void;
};

function ListModel({
  kind,
  profile,
  lift,
}: {
  kind: ProfileListKind;
  profile: UserProfile;
  lift: (model: NativeProfileList | null, controls: ListControls | null) => void;
}) {
  const list = useProfileList(kind, profile);
  useLift<NativeProfileList, ListControls>(
    {
      kind,
      title: list.title,
      filter: list.ownFollowers
        ? { value: list.filter, mutualDisabled: list.mutualIds === null }
        : null,
      mutualChecking: list.ownFollowers && list.mutualIds === null && !list.mutualError,
      mutualError: list.ownFollowers ? list.mutualError || null : null,
      loading: list.state === "loading",
      error: list.error || null,
      retry: list.state !== "loading",
      people:
        kind === "articles" || list.state !== "ready"
          ? []
          : list.shownPeople.map((person) => ({
              userId: person.userId,
              nickname: person.nickname,
              profileImageUrl: person.profileImageUrl,
              instrument: person.primaryInstrument || "",
            })),
      posts: kind === "articles" ? list.posts.map(nativePost) : [],
      emptyMessage: list.emptyMessage,
    },
    { retry: list.retry, retryMutual: list.retryMutual, setFilter: list.setFilter },
    lift,
  );
  return null;
}

/** In the app /profile and /users/:userId are drawn natively (native/screens/profile/profile.tsx). */
export function NativeProfileBridge({
  userId,
  onEdit,
  onProfile,
  onOpenShort,
  onOpenPost,
  onChat,
  onNavigate,
  onSearch,
  onBack,
}: {
  userId?: number;
  onEdit: () => void;
  onProfile: (id: number) => void;
  onOpenShort: (id: number) => void;
  onOpenPost: (id: number) => void;
  onChat: (id: number) => void;
  onNavigate: (path: string) => void;
  onSearch: () => void;
  onBack: () => void;
}) {
  const currentUserId = useCurrentUserId();
  const { requireLogin } = useLoginPrompt();
  const own = userId === undefined || userId === currentUserId;
  const { profile, loading, error } = useOwnProfile(userId);
  const [listKind, setListKind] = useState<ProfileListKind | null>(null);
  const relation = useLifted<NativeProfileRelation, RelationControls>();
  const works = useLifted<NativeProfileWorks[], WorksControls>();
  const list = useLifted<NativeProfileList, ListControls>();

  const sections: NativeProfileWorks[] = profile
    ? [
        {
          key: "featured",
          title: uiLabels.featuredMusic,
          status: "ready",
          error: null,
          songs: featuredSongs(profile).map(({ shortId, title, albumImageUrl }) => ({
            shortId,
            title,
            albumImageUrl,
          })),
          emptyMessage: "아직 등록한 곡이 없습니다.",
          all: "chart",
        },
        ...(own
          ? (works.model ?? [])
          : [
              {
                key: "participated" as const,
                title: uiLabels.participatedMusic,
                status: "ready" as const,
                error: null,
                songs: profile.activities.participatedShorts,
                emptyMessage: "아직 등록한 곡이 없습니다.",
                all: "sheet" as const,
              },
            ]),
      ]
    : [];

  const model: NativeProfile = {
    status: loading ? "loading" : profile ? "ready" : "error",
    message: loading ? "프로필을 불러오는 중..." : (error ?? (profile ? "" : "프로필이 없습니다.")),
    own,
    user: profile && {
      userId: profile.userId,
      nickname: profile.nickname,
      profileImageUrl: profile.profileImageUrl,
      followers: compactCount(profile.relations.followerCount),
      following: compactCount(profile.relations.followingCount),
      posts: compactCount(profile.activities.postCount),
      instruments: profileInstruments(profile),
      explanation: profile.explanation || "아직 소개가 없습니다.",
    },
    relation: !own && profile ? relation.model : null,
    sections,
    list: listKind && profile ? list.model : null,
  };

  const node = useNativeScreen("profile-view", model, {
    header: { left: "back", actions: ["notifications", "search", own ? "settings" : "account"] },
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "edit":
          if (own) onEdit();
          return;
        case "follow":
          return relation.controls.current?.change();
        case "recheck-follow":
          return relation.controls.current?.recheck();
        case "chat":
          return relation.controls.current?.chat();
        case "open-list":
          if (requireLogin()) setListKind(action.kind);
          return;
        case "close-list":
          return setListKind(null);
        case "list-retry":
          return list.controls.current?.retry();
        case "mutual-retry":
          return list.controls.current?.retryMutual();
        case "list-filter":
          return list.controls.current?.setFilter(action.filter);
        case "all-works":
          if (!profile) return;
          if (action.section === "featured") return onNavigate(featuredChartPath(profile, own));
          if (own) {
            const path = works.controls.current?.paths[action.section];
            if (path) onNavigate(path);
          }
          return;
        case "works-retry":
          return works.controls.current?.retry();
        case "open-short":
          return onOpenShort(action.shortId);
        case "open-post":
          setListKind(null);
          return onOpenPost(action.postId);
        case "open-profile":
          setListKind(null);
          return onProfile(action.userId);
      }
    },
  });

  return (
    <>
      {node}
      {profile && !own && (
        <RelationModel
          key={profile.userId}
          profile={profile}
          onChat={onChat}
          lift={relation.lift}
        />
      )}
      {profile && own && <OwnWorksModel lift={works.lift} />}
      {profile && listKind && (
        <ListModel key={listKind} kind={listKind} profile={profile} lift={list.lift} />
      )}
    </>
  );
}

/** Downscaled data URL of a picked photo, for the app's preview (blob: URLs do not reach the app). */
async function previewDataUrl(file: File): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = 280;
    const scale = Math.max(size / bitmap.width, size / bitmap.height);
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas
      .getContext("2d")
      ?.drawImage(
        bitmap,
        (size - bitmap.width * scale) / 2,
        (size - bitmap.height * scale) / 2,
        bitmap.width * scale,
        bitmap.height * scale,
      );
    bitmap.close();
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}

function EditForm({
  profile,
  onSaved,
  lift,
}: {
  profile: UserProfile;
  onSaved: () => void;
  lift: (model: EditFormModel | null, controls: EditFormControls | null) => void;
}) {
  const form = useProfileForm(useSaveProfile(onSaved));
  const privacy = useProfilePrivacy();
  const [preview, setPreview] = useState<string | null>(null);
  const file = form.image?.file ?? null;
  useEffect(() => {
    if (!file) return;
    let current = true;
    void previewDataUrl(file).then((url) => {
      if (current) setPreview(url);
    });
    return () => {
      current = false;
    };
  }, [file]);
  useLift<EditFormModel, EditFormControls>(
    {
      imagePreview: file ? preview : null,
      privacy: { isPrivate: profile.isPrivate, busy: privacy.busy, error: privacy.error },
      saving: form.saving,
      error: form.error,
    },
    { pick: form.pick, save: form.save, privacy: privacy.change },
    lift,
  );
  return null;
}

type EditFormModel = Pick<NativeEditProfile, "imagePreview" | "privacy" | "saving" | "error">;
type EditFormControls = {
  pick: (file: File) => void;
  save: (draft: { nickname: string; instrument: string; explanation: string }) => Promise<void>;
  privacy: (value: boolean) => void;
};

/** In the app /profile/edit is drawn natively (native/screens/profile/edit-profile.tsx). */
export function NativeEditProfileBridge({
  onSaved,
  onPrivacyPolicy,
  onSearch,
  onBack,
}: {
  onSaved: () => void;
  onPrivacyPolicy: () => void;
  onSearch: () => void;
  onBack: () => void;
}) {
  const { profile, loading, error } = useOwnProfile();
  const form = useLifted<EditFormModel, EditFormControls>();
  const saving = form.model?.saving ?? false;
  const model: NativeEditProfile = {
    status: loading ? "loading" : profile ? "ready" : "error",
    message: loading ? "프로필을 불러오는 중..." : (error ?? (profile ? "" : "프로필이 없습니다.")),
    initial: profile && {
      userId: profile.userId,
      nickname: profile.nickname,
      instrument: profile.primaryInstrument ?? "",
      explanation: profile.explanation ?? "",
      imageUrl: profile.profileImageUrl,
    },
    imagePreview: form.model?.imagePreview ?? null,
    privacy: form.model?.privacy ?? null,
    saving,
    error: form.model?.error ?? null,
    submitLabel: "프로필 저장",
  };
  const node = useNativeScreen("profile-edit", model, {
    header: { left: "back", actions: ["notifications", "search", "settings"] },
    onBack,
    onSearch,
    onAction: (action) => {
      const controls = form.controls.current;
      switch (action.type) {
        case "pick-image":
          if (!controls || saving) return;
          void pickNativeImage()
            .then((file) => {
              if (file) controls.pick(file);
            })
            .catch((cause: unknown) =>
              window.alert(cause instanceof Error ? cause.message : String(cause)),
            );
          return;
        case "privacy":
          return controls?.privacy(action.value);
        case "save":
          if (controls && !saving)
            void controls.save({
              nickname: action.nickname,
              instrument: action.instrument,
              explanation: action.explanation,
            });
          return;
        case "open-privacy-policy":
          return onPrivacyPolicy();
      }
    },
  });
  return (
    <>
      {node}
      {profile && (
        <EditForm key={profile.userId} profile={profile} onSaved={onSaved} lift={form.lift} />
      )}
    </>
  );
}

/** In the app /profile/likes is drawn natively (native/screens/profile/liked-posts.tsx). */
export function NativeLikedPostsBridge({
  onOpenPost,
  onSearch,
  onBack,
}: {
  onOpenPost: (postId: number) => void;
  onSearch: () => void;
  onBack: () => void;
}) {
  const { idsQuery, ids, loaded, loading, idsError, failed, forbidden, posts, more } =
    useLikedPosts();
  const model: NativeLikedPosts = {
    status: idsError ? "error" : ids ? "ready" : "loading",
    error: idsError,
    forbidden,
    posts: posts.map(nativePost),
    empty:
      ids && !loading && !idsError && posts.length === 0 && failed.length === 0
        ? {
            message:
              loaded < ids.length
                ? "다음 목록을 확인해 주세요."
                : "표시할 좋아요 게시글이 없습니다.",
            disabled: idsQuery.isFetching || loading,
          }
        : null,
    failed: failed.length > 0 ? { count: failed.length, disabled: loading } : null,
    more: ids && loaded < ids.length ? { busy: loading } : null,
  };
  return useNativeScreen("profile-likes", model, {
    header: { left: "back", actions: ["notifications", "search", "account"] },
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "retry":
        case "reload":
          return void idsQuery.refetch();
        case "retry-failed":
          for (const detail of failed) void detail.refetch();
          return;
        case "more":
          if (ids && loaded < ids.length && !loading) more();
          return;
        case "open-post":
          return onOpenPost(action.postId);
      }
    },
  });
}
