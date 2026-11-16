import { useLoginPrompt } from "@/features/auth/login-prompt";
import { profileStyles } from "@/styles/profile.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { buttonVariants } from "@/styles/variants";
import { cn } from "@/lib/utils";
import { uiLabels } from "@/lib/ui-labels";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProfileListSheet, type ProfileListKind } from "./profile-lists";
import { ProfilePrivacyToggle, ProfileRelationActions } from "./profile-relations";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
import { AlbumArtwork, MusicCard } from "@/components/music-card";
import { SectionTitle } from "@/components/section-title";
import { FigmaSheet } from "@/components/figma-sheet";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { updateProfile, updateProfileImage } from "@/lib/api/profile";
import type { UserProfile } from "@/lib/api/contracts";
import { Link, useNavigate } from "react-router";
import { useMySongs } from "@/features/home/use-my-songs";
import { songsForTab } from "@/features/home/my-songs";
import { profileKeys, profileQuery } from "./profile-queries";

export function profileErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "프로필을 불러오지 못했습니다.";
}

export function useOwnProfile(targetUserId?: number) {
  const currentUserId = useCurrentUserId();
  const userId = targetUserId ?? currentUserId;
  const query = useQuery({ ...profileQuery(currentUserId, userId ?? 0), enabled: userId !== null });

  if (userId === null) {
    return { profile: null, loading: false, error: "로그인이 필요합니다." };
  }
  if (query.data) return { profile: query.data, loading: false, error: null };
  if (query.isError) {
    return { profile: null, loading: false, error: profileErrorMessage(query.error) };
  }
  return { profile: null, loading: true, error: null };
}

export function compactCount(count: number) {
  return count >= 1000 ? `${Number((count / 1000).toFixed(1))}k` : String(count);
}

export function profileInstruments(profile: UserProfile): string[] {
  return (
    profile.primaryInstrument
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
}

export function featuredSongs(profile: UserProfile) {
  return [...profile.activities.pinnedShorts].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function featuredChartPath(profile: UserProfile, own: boolean) {
  return own ? "/charts?kind=mine&tab=featured" : `/charts?kind=mine&tab=featured&userId=${profile.userId}`;
}

function ProfileWorks({
  title,
  songs,
  onOpen,
  allHref,
}: {
  title: string;
  songs: UserProfile["activities"]["participatedShorts"];
  onOpen: (id: number) => void;
  allHref?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();
  return (
    <section className={profileStyles.profileSection}>
      <SectionTitle
        className="mb-0! px-0!"
        allLabel="모두보기"
        onAll={() => allHref ? navigate(allHref) : setShowAll(true)}
      >
        {title}
      </SectionTitle>
      {songs.length ? (
        <div className={cn(sharedStyles.songRail, profileStyles.profileSongRail)}>
          {songs.map((song) => (
            <MusicCard
              key={song.shortId}
              title={song.title}
              albumImageUrl={song.albumImageUrl}
              onOpen={() => onOpen(song.shortId)}
            />
          ))}
        </div>
      ) : (
        <p className={profileStyles.profileDescription}>아직 등록한 곡이 없습니다.</p>
      )}
      {showAll && (
        <FigmaSheet title={`${title} 전체 목록`} onClose={() => setShowAll(false)}>
          <section className={profileStyles.profileListPanel}>
            <h1>{title}</h1>
            {songs.length ? (
              <ul className={profileStyles.profilePeopleList}>
                {songs.map((song) => (
                  <li key={song.shortId}>
                    <button onClick={() => {
                      setShowAll(false);
                      onOpen(song.shortId);
                    }}>
                      <AlbumArtwork src={song.albumImageUrl} title={song.title} className="size-11 shrink-0 rounded-[6px]" />
                      <span className="min-w-0 flex-1"><strong className="block truncate">{song.title}</strong></span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={profileStyles.profileListEmpty}>아직 등록한 곡이 없습니다.</p>
            )}
          </section>
        </FigmaSheet>
      )}
    </section>
  );
}

export const ownWorkTabs = ["authored", "participated"] as const;

/** "내 작업물" / "내 참가작" of the signed-in user's profile: the first songs of each kind. */
export function useOwnWorks() {
  const userId = useCurrentUserId();
  const songs = useMySongs(10);
  return {
    songs,
    sections: ownWorkTabs.map((tab) => ({
      tab,
      title: tab === "authored" ? "내 작업물" : "내 참가작",
      allPath: `/charts?kind=mine&tab=${tab}`,
      items: userId === null ? [] : songsForTab(songs.items, userId, tab).slice(0, 6),
      emptyMessage: songs.hasMore
        ? "전체 목록에서 더 많은 곡을 확인해 주세요."
        : tab === "authored"
          ? "아직 작성한 곡이 없습니다."
          : "아직 참가한 곡이 없습니다.",
    })),
  };
}

function OwnWorks({ onOpen }: { onOpen: (id: number) => void }) {
  const navigate = useNavigate();
  const { songs, sections } = useOwnWorks();
  return (
    <>
      {sections.map(({ tab, title, allPath, items, emptyMessage }) => {
        return (
          <section className={profileStyles.profileSection} key={tab}>
            <SectionTitle
              className="mb-0! px-0!"
              onAll={() => navigate(allPath)}
            >
              {title}
            </SectionTitle>
            {songs.status === "loading" && (
              <p role="status" className={profileStyles.profileDescription}>음악을 불러오는 중...</p>
            )}
            {songs.status === "error" && (
              <div role="alert" className={profileStyles.profileWorkStatus}>
                <p className="m-0">{songs.error}</p>
                <button
                  type="button"
                  className={buttonVariants({ tone: "secondary" })}
                  onClick={songs.retry}
                >
                  다시 시도
                </button>
              </div>
            )}
            {items.length > 0 && (
              <div className={cn(sharedStyles.songRail, profileStyles.profileSongRail)}>
                {items.map((song) => (
                  <MusicCard
                    key={song.shortId}
                    title={song.title}
                    albumImageUrl={song.albumImageUrl}
                    onOpen={() => onOpen(song.shortId)}
                  />
                ))}
              </div>
            )}
            {songs.status === "ready" && items.length === 0 && (
              <p className={profileStyles.profileDescription}>
                {emptyMessage}
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}

export function ProfileScreen({
  onEdit,
  onProfile,
  onOpenShort,
  userId,
  onOpenPost,
  onChat,
}: {
  userId?: number;
  onEdit: () => void;
  onProfile: (id: number) => void;
  onOpenShort: (id: number) => void;
  onOpenPost: (id: number) => void;
  onChat: (id: number) => void;
}) {
  const currentUserId = useCurrentUserId();
  const { requireLogin } = useLoginPrompt();
  const [list, setList] = useState<ProfileListKind | null>(null);
  const own = userId === undefined || userId === currentUserId;
  const { profile, loading, error } = useOwnProfile(userId);

  if (loading) {
    return (
      <div className={profileStyles.profileState} role="status">
        프로필을 불러오는 중...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className={profileStyles.profileState} role="alert">
        {error ?? "프로필이 없습니다."}
      </div>
    );
  }

  const instruments = profileInstruments(profile);

  return (
    <div className={cn(profileStyles.profileView, sharedStyles.scrollContent)}>
      <div className={profileStyles.profileIdentity}>
        <button
          className={profileStyles.profileEditTrigger}
          onClick={own ? onEdit : undefined}
          disabled={!own}
          aria-label={own ? "프로필 편집" : "사용자 프로필 사진"}
        >
          <Avatar large src={profile.profileImageUrl} />
        </button>

        <h1>{profile.nickname}</h1>
        {!own && (
          <ProfileRelationActions key={profile.userId} profile={profile} onChat={onChat} />
        )}

        <div className={cn(sharedStyles.stats, "w-full px-0!")}>
          <button aria-label="팔로워 목록" onClick={() => { if (requireLogin()) setList("followers"); }}>
            <strong>팔로워</strong>
            <small>{compactCount(profile.relations.followerCount)}</small>
          </button>
          <button aria-label="팔로잉 목록" onClick={() => { if (requireLogin()) setList("following"); }}>
            <strong>팔로잉</strong>
            <small>{compactCount(profile.relations.followingCount)}</small>
          </button>
          <button aria-label="작성한 게시글 목록" onClick={() => { if (requireLogin()) setList("articles"); }}>
            <strong>게시글</strong>
            <small>{compactCount(profile.activities.postCount)}</small>
          </button>
        </div>

        {instruments.length > 0 && (
          <div className={cn(sharedStyles.tags, "justify-center p-0!")}>
            {instruments.map((instrument) => (
              <span key={instrument}>{instrument}</span>
            ))}
          </div>
        )}
      </div>

      <div className={profileStyles.profileSections}>
        <section className={profileStyles.profileSection}>
          <h2 className={profileStyles.profileSectionHeading}>소개</h2>
          <p className={profileStyles.profileDescription}>{profile.explanation || "아직 소개가 없습니다."}</p>
        </section>

        <ProfileWorks
          title={uiLabels.featuredMusic}
          songs={featuredSongs(profile)}
          onOpen={onOpenShort}
          allHref={featuredChartPath(profile, own)}
        />
        {own ? <OwnWorks onOpen={onOpenShort} /> : (
          <ProfileWorks
            title={uiLabels.participatedMusic}
            songs={profile.activities.participatedShorts}
            onOpen={onOpenShort}
          />
        )}
      </div>
      {list && (
        <ProfileListSheet
          kind={list}
          profile={profile}
          onClose={() => setList(null)}
          onProfile={onProfile}
          onPost={onOpenPost}
        />
      )}
    </div>
  );
}

/** Saves the signed-in user's profile edits (and new photo) and updates the cached profile. */
export function useSaveProfile(onSaved: () => void) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
  return async ({ nickname, instrument, explanation, image }: ProfileDraft) => {
    const updated = await updateProfile({
      nickname,
      primaryInstrument: instrument,
      explanation,
    });

    const uploaded = image ? await updateProfileImage(image) : null;

    if (userId !== null) {
      queryClient.setQueryData<UserProfile>(profileKeys.detail(userId, userId), (current) => current && {
        ...current,
        ...updated,
        profileImageUrl: uploaded?.profileImageUrl ?? current.profileImageUrl,
      });
      void queryClient.invalidateQueries({ queryKey: profileKeys.all(userId) });
    }

    onSaved();
  };
}

export function EditProfileScreen({ onSaved }: { onSaved: () => void }) {
  const save = useSaveProfile(onSaved);
  const { profile, loading, error: loadError } = useOwnProfile();

  if (loading) {
    return (
      <div className={profileStyles.profileState} role="status">
        프로필을 불러오는 중...
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className={profileStyles.profileState} role="alert">
        {loadError ?? "프로필이 없습니다."}
      </div>
    );
  }

  return (
    <ProfileForm
      topSlot={<ProfilePrivacyToggle isPrivate={profile.isPrivate} />}
      initial={{
        nickname: profile.nickname,
        instrument: profile.primaryInstrument ?? "",
        explanation: profile.explanation ?? "",
        imageUrl: profile.profileImageUrl,
      }}
      submitLabel="프로필 저장"
      onSubmit={save}
    />
  );
}

export type ProfileDraft = {
  nickname: string;
  instrument: string;
  explanation: string;
  image: File | null;
};

function validateProfileImage(file: File): void {
  if (!new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]).has(file.type)) {
    throw new Error("JPG, PNG, WEBP 또는 GIF 이미지를 선택해 주세요.");
  }

  if (file.size > 25 * 1024 * 1024) {
    throw new Error("프로필 이미지는 25MB 이하여야 합니다.");
  }
}

/** Photo, saving and error state of the profile form; the caller keeps the text fields. */
export function useProfileForm(onSubmit: (draft: ProfileDraft) => Promise<void>) {
  const [image, setImage] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (image) {
        URL.revokeObjectURL(image.previewUrl);
      }
    },
    [image],
  );

  function pick(file: File) {
    try {
      validateProfileImage(file);

      setImage((current) => {
        if (current) {
          URL.revokeObjectURL(current.previewUrl);
        }

        return {
          file,
          previewUrl: URL.createObjectURL(file),
        };
      });

      setError(null);
    } catch (cause) {
      setError(profileErrorMessage(cause));
    }
  }

  async function save({ nickname, instrument, explanation }: Omit<ProfileDraft, "image">) {
    if (!nickname.trim()) {
      setError("이름을 입력해 주세요.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSubmit({
        nickname: nickname.trim(),
        instrument: instrument.trim(),
        explanation: explanation.trim(),
        image: image?.file ?? null,
      });
    } catch (cause) {
      setError(profileErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return { image, saving, error, pick, save };
}

export function ProfileForm({
  topSlot,
  initial,
  submitLabel,
  onSubmit,
}: {
  topSlot?: ReactNode;
  initial: {
    nickname: string;
    instrument: string;
    explanation: string;
    imageUrl: string | null;
  };
  submitLabel: string;
  onSubmit: (draft: ProfileDraft) => Promise<void>;
}) {
  const [nickname, setNickname] = useState(initial.nickname);
  const [instrument, setInstrument] = useState(initial.instrument);
  const [explanation, setExplanation] = useState(initial.explanation);
  const { image, saving, error, pick, save } = useProfileForm(onSubmit);

  return (
    <div className={cn(profileStyles.editView, sharedStyles.scrollContent)}>
      {topSlot}
      <label className={profileStyles.editAvatar}>
        <span className={profileStyles.editAvatarVisual}>
          <Avatar large src={image?.previewUrl ?? initial.imageUrl} />

          <span className={profileStyles.editAvatarOverlay} aria-hidden>
            <Asset name="profile-photo-shade.svg" className={profileStyles.profilePhotoShade} />
            <Asset name="profile-photo-add.svg" className={profileStyles.profilePhotoAdd} />
          </span>
        </span>

        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          disabled={saving}
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";

            if (!file) return;

            pick(file);
          }}
        />
      </label>

      <label>
        <strong>이름</strong>
        <input
          value={nickname}
          onChange={(event) => setNickname(event.target.value)}
          maxLength={30}
          disabled={saving}
        />
      </label>

      <label>
        <strong>악기</strong>
        <input
          value={instrument}
          onChange={(event) => setInstrument(event.target.value)}
          disabled={saving}
          placeholder="예: Guitar, Piano"
        />
      </label>

      <label>
        <strong>설명</strong>
        <textarea
          value={explanation}
          onChange={(event) => setExplanation(event.target.value)}
          disabled={saving}
        />
      </label>

      {error && (
        <p className={profileStyles.profileFormError} role="alert">
          {error}
        </p>
      )}

      <button
        className={profileStyles.profileSaveButton}
        disabled={saving}
        onClick={() => void save({ nickname, instrument, explanation })}
      >
        {saving ? "저장 중..." : submitLabel}
      </button>
      <Link className="mt-4 block text-center text-caption text-app-muted underline" to="/privacy">개인정보처리방침</Link>
    </div>
  );
}
