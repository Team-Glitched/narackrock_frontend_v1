import { profileStyles } from "@/styles/profile.styles";
import { sharedStyles } from "@/styles/shared.styles";
import { cn } from "@/lib/utils";
import { uiLabels } from "@/lib/ui-labels";
import { useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ProfileListSheet, type ProfileListKind } from "./profile-lists";
import { ProfilePrivacyToggle, ProfileRelationActions } from "./profile-relations";
import { Asset } from "@/components/asset";
import { Avatar } from "@/components/avatar";
import { SectionTitle } from "@/components/section-title";
import { FigmaSheet } from "@/components/figma-sheet";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { ApiError } from "@/lib/api/client";
import { updateFeaturedMusic, updateProfile, updateProfileImage } from "@/lib/api/profile";
import type { UserProfile } from "@/lib/api/contracts";
import { Link, useNavigate } from "react-router";
import { useMySongs } from "@/features/home/use-my-songs";
import { songsForTab } from "@/features/home/my-songs";
import { profileKeys, profileQuery } from "./profile-queries";

function profileErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "프로필을 불러오지 못했습니다.";
}

function useOwnProfile(targetUserId?: number) {
  const currentUserId = useCurrentUserId();
  const userId = targetUserId ?? currentUserId;
  const query = useQuery({ ...profileQuery(currentUserId, userId ?? 0), enabled: userId !== null });
  const reload = () => { if (userId !== null) void query.refetch(); };

  if (userId === null) {
    return { profile: null, loading: false, error: "로그인이 필요합니다.", reload };
  }
  if (query.data) return { profile: query.data, loading: false, error: null, reload };
  if (query.isError) {
    return { profile: null, loading: false, error: profileErrorMessage(query.error), reload };
  }
  return { profile: null, loading: true, error: null, reload };
}

function compactCount(count: number) {
  return count >= 1000 ? `${Number((count / 1000).toFixed(1))}k` : String(count);
}
function ProfileWorks({
  title,
  songs,
  onOpen,
  titleAction,
  children,
  allHref,
}: {
  title: string;
  songs: UserProfile["activities"]["participatedShorts"];
  onOpen: (id: number) => void;
  titleAction?: ReactNode;
  children?: ReactNode;
  allHref?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const navigate = useNavigate();
  return (
    <section className={profileStyles.profileWorks}>
      <SectionTitle
        allLabel="모두보기"
        onAll={() => allHref ? navigate(allHref) : setShowAll(true)}
      >
        <span className="flex items-center gap-2">
          {title}
          {titleAction}
        </span>
      </SectionTitle>
      {children}
      {songs.length ? (
        <div className={sharedStyles.songRail}>
          {songs.map((song) => (
            <button
              className={sharedStyles.songCard}
              key={song.shortId}
              onClick={() => onOpen(song.shortId)}
              aria-label={`${song.title} 열기`}
            >
              <span className={sharedStyles.songArt}>
                {song.albumImageUrl ? (
                  <img src={song.albumImageUrl} alt={`${song.title} 앨범 커버`} />
                ) : (
                  <span className={sharedStyles.emptyArtwork} />
                )}
              </span>
              <strong>{song.title}</strong>
            </button>
          ))}
        </div>
      ) : (
        <p className={profileStyles.profileEmptyWork}>아직 등록한 곡이 없습니다.</p>
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
                      <Avatar src={song.albumImageUrl} />
                      <span><strong>{song.title}</strong></span>
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

function FeaturedMusicEditor({
  userId,
  hasFeaturedMusic,
  onSaved,
  featuredSongs,
  onOpen,
}: {
  userId: number;
  hasFeaturedMusic: boolean;
  onSaved: () => void;
  featuredSongs: UserProfile["activities"]["pinnedShorts"];
  onOpen: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const songs = useMySongs(20, open);
  const eligible = songsForTab(songs.items, userId, "authored")
    .filter((song) => song.completionStatus === "COMPLETED");

  async function save(shortId: number | null) {
    setSaving(true);
    setSaveError(null);
    try {
      await updateFeaturedMusic(shortId);
      setSelection("");
      setOpen(false);
      onSaved();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "대표 음악을 변경하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ProfileWorks
      title={uiLabels.featuredMusic}
      songs={[...featuredSongs].sort((a, b) => a.displayOrder - b.displayOrder)}
      onOpen={onOpen}
      allHref="/charts?kind=mine&tab=featured"
      titleAction={
      <button
        type="button"
        aria-expanded={open}
        disabled={saving}
        className="shrink-0 rounded border border-app-muted px-1.5 py-0.5 text-[12px]! font-medium leading-[16px]! tracking-normal text-app-muted"
        onClick={() => {
          setOpen(!open);
          setSelection("");
          setSaveError(null);
        }}
      >
        {open ? "닫기" : "대표 음악 설정"}
      </button>
      }
    >
      {open && (
        <div className="mx-4 mb-4 grid gap-3 text-label">
          {songs.status === "loading" && <p role="status">내 작업물을 불러오는 중...</p>}
          {songs.error && <p role="alert">{songs.error}</p>}
          {songs.status === "error" && <button type="button" onClick={songs.retry}>다시 시도</button>}
          {eligible.length > 0 && (
            <form className="grid gap-2" onSubmit={(event) => {
              event.preventDefault();
              if (!saving && selection) void save(Number(selection));
            }}>
              <label htmlFor="featured-music-select">내 작업물에서 완성곡 선택</label>
              <select
                id="featured-music-select"
                className="rounded-lg border border-app-muted bg-app-surface p-2"
                value={selection}
                disabled={saving}
                onChange={(event) => setSelection(event.target.value)}
              >
                <option value="">곡을 선택해 주세요</option>
                {eligible.map((song) => <option key={song.shortId} value={song.shortId}>{song.title}</option>)}
              </select>
              <button type="submit" className="justify-self-start rounded-lg bg-app-primary px-3 py-2" disabled={!selection || saving}>
                저장
              </button>
            </form>
          )}
          {songs.hasMore && (
            <button type="button" disabled={songs.appending || saving} onClick={songs.loadMore}>
              {songs.appending ? "불러오는 중..." : "작업물 더 보기"}
            </button>
          )}
          {songs.status === "ready" && !songs.hasMore && eligible.length === 0 && (
            <p>등록할 완성곡이 없습니다. <Link className="underline" to="/studio/new">곡 만들기</Link></p>
          )}
          {hasFeaturedMusic && (
            <button type="button" className="justify-self-start underline" disabled={saving} onClick={() => void save(null)}>
              대표 음악 해제
            </button>
          )}
          {saveError && <p role="alert">{saveError}</p>}
        </div>
      )}
    </ProfileWorks>
  );
}

function OwnWorks({ onOpen }: { onOpen: (id: number) => void }) {
  const userId = useCurrentUserId();
  const navigate = useNavigate();
  const songs = useMySongs(10);
  return (
    <>
      {(["authored", "participated"] as const).map((tab) => {
        const items = userId === null ? [] : songsForTab(songs.items, userId, tab);
        return (
          <section className={profileStyles.profileWorks} key={tab}>
            <SectionTitle onAll={() => navigate(`/charts?kind=mine&tab=${tab}`)}>
              {tab === "authored" ? "내 작업물" : "내 참가작"}
            </SectionTitle>
            {songs.status === "loading" && <p role="status">음악을 불러오는 중...</p>}
            {songs.status === "error" && <div role="alert"><p>{songs.error}</p><button onClick={songs.retry}>다시 시도</button></div>}
            <div className={sharedStyles.songRail}>
              {items.slice(0, 6).map((song) => (
                <button key={song.shortId} className={sharedStyles.songCard} onClick={() => onOpen(song.shortId)}>
                  <span className={sharedStyles.songArt}>
                    {song.albumImageUrl ? <img src={song.albumImageUrl} alt={`${song.title} 앨범 커버`} />
                      : <span className={sharedStyles.emptyArtwork} />}
                  </span>
                  <strong>{song.title}</strong>
                </button>
              ))}
            </div>
            {songs.status === "ready" && items.length === 0 && <p className={profileStyles.profileEmptyWork}>
              {songs.hasMore ? "전체 목록에서 더 많은 곡을 확인해 주세요." : tab === "authored" ? "아직 작성한 곡이 없습니다." : "아직 참가한 곡이 없습니다."}
            </p>}
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
  const [list, setList] = useState<ProfileListKind | null>(null);
  const own = userId === undefined || userId === currentUserId;
  const { profile, loading, error, reload } = useOwnProfile(userId);

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

  const instruments =
    profile.primaryInstrument
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? [];

  return (
    <div className={cn(profileStyles.profileView, sharedStyles.scrollContent)}>
      <button
        className={profileStyles.profileEditTrigger}
        onClick={own ? onEdit : undefined}
        disabled={!own}
        aria-label={own ? "프로필 편집" : "사용자 프로필 사진"}
      >
        <Avatar large src={profile.profileImageUrl} />
      </button>

      <h1>{profile.nickname}</h1>
      {!own && currentUserId !== null && (
        <ProfileRelationActions key={profile.userId} profile={profile} onChat={onChat} />
      )}

      <div className={sharedStyles.stats}>
        <button aria-label="팔로워 목록" onClick={() => setList("followers")}>
          <strong>팔로워</strong>
          <small>{compactCount(profile.relations.followerCount)}</small>
        </button>
        <button aria-label="팔로잉 목록" onClick={() => setList("following")}>
          <strong>팔로잉</strong>
          <small>{compactCount(profile.relations.followingCount)}</small>
        </button>
        <button aria-label="작성한 게시글 목록" onClick={() => setList("articles")}>
          <strong>게시글</strong>
          <small>{compactCount(profile.activities.postCount)}</small>
        </button>
      </div>

      {instruments.length > 0 && (
        <div className={cn(sharedStyles.tags, "flex-wrap justify-center")}>
          {instruments.map((instrument) => (
            <span key={instrument}>{instrument}</span>
          ))}
        </div>
      )}

      <section className={sharedStyles.description}>
        <h2>소개</h2>
        <p>{profile.explanation || "아직 소개가 없습니다."}</p>
      </section>

      {own && currentUserId !== null ? (
        <FeaturedMusicEditor
          key={currentUserId}
          userId={currentUserId}
          hasFeaturedMusic={profile.activities.pinnedShorts.length > 0}
          featuredSongs={profile.activities.pinnedShorts}
          onOpen={onOpenShort}
          onSaved={reload}
        />
      ) : (
        <ProfileWorks
          title={uiLabels.featuredMusic}
          songs={[...profile.activities.pinnedShorts].sort((a, b) => a.displayOrder - b.displayOrder)}
          onOpen={onOpenShort}
          allHref={`/charts?kind=mine&tab=featured&userId=${profile.userId}`}
        />
      )}
      {own ? <OwnWorks onOpen={onOpenShort} /> : (
        <ProfileWorks
          title={uiLabels.participatedMusic}
          songs={profile.activities.participatedShorts}
          onOpen={onOpenShort}
        />
      )}
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

export function EditProfileScreen({ onSaved }: { onSaved: () => void }) {
  const userId = useCurrentUserId();
  const queryClient = useQueryClient();
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
    <>
    <ProfilePrivacyToggle isPrivate={profile.isPrivate} />
    <ProfileForm
      initial={{
        nickname: profile.nickname,
        instrument: profile.primaryInstrument ?? "",
        explanation: profile.explanation ?? "",
        imageUrl: profile.profileImageUrl,
      }}
      submitLabel="프로필 저장"
      onSubmit={async ({ nickname, instrument, explanation, image }) => {
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
      }}
    />
    </>
  );
}

export function InitialProfileSetupScreen({
  suggestedNickname,
  onSaved,
}: {
  suggestedNickname: string;
  pictureUrl: string | null;
  onSaved: () => void;
}) {
  const [step, setStep] = useState(0);
  const [nickname, setNickname] = useState(suggestedNickname);
  const [instrument, setInstrument] = useState("");
  const [explanation, setExplanation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function advance(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (step === 0) {
      if (!nickname.trim()) {
        setError("이름을 입력해 주세요.");
        return;
      }

      setStep(1);
      return;
    }

    if (step === 1) {
      if (!instrument.trim()) {
        setError("주 악기를 입력해 주세요.");
        return;
      }

      setStep(2);
      return;
    }

    if (!explanation.trim()) {
      setError("설명을 입력해 주세요.");
      return;
    }

    setSaving(true);

    try {
      await updateProfile({
        nickname: nickname.trim(),
        primaryInstrument: instrument.trim(),
        explanation: explanation.trim(),
      });

      onSaved();
    } catch (cause) {
      if (cause instanceof ApiError && cause.errorCode === "DUPLICATE_NICKNAME") {
        setStep(0);
      }

      setError(profileErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className={profileStyles.profileOnboarding}
      onSubmit={(event) => {
        void advance(event);
      }}
    >
      <header className={profileStyles.authHeader}>
        <Asset name="auth-logo.svg" alt="Narackrock" />
      </header>

      <div className={profileStyles.profileOnboardingContent} key={step}>
        {step === 0 && (
          <>
            <h1>당신의 이름은 무엇인가요?</h1>
            <p>이름을 알려주세요</p>
            <label>
              이름
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={30}
                autoFocus
                disabled={saving}
              />
            </label>
          </>
        )}

        {step === 1 && (
          <>
            <h1>당신의 주 악기는 무엇인가요?</h1>
            <p>악기를 알려주세요</p>
            <label>
              악기
              <input
                value={instrument}
                onChange={(event) => setInstrument(event.target.value)}
                placeholder="피아노, 기타"
                autoFocus
                disabled={saving}
              />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <h1>당신을 설명해주세요</h1>
            <p>당신은 어떤 사람인가요?</p>
            <label>
              설명
              <input
                value={explanation}
                onChange={(event) => setExplanation(event.target.value)}
                autoFocus
                disabled={saving}
              />
            </label>
          </>
        )}

        {error && (
          <p className={profileStyles.profileFormError} role="alert">
            {error}
          </p>
        )}

        <button type="submit" className={profileStyles.profileOnboardingNext} disabled={saving}>
          {saving ? "저장 중..." : step === 2 ? "시작하기" : "다음"}
        </button>
      </div>
    </form>
  );
}

type ProfileDraft = {
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

export function ProfileForm({
  initial,
  submitLabel,
  onSubmit,
}: {
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

  async function save() {
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

  return (
    <div className={cn(profileStyles.editView, sharedStyles.scrollContent)}>
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
        onClick={() => void save()}
      >
        {saving ? "저장 중..." : submitLabel}
      </button>
      <Link className="mt-4 block text-center text-caption text-app-muted underline" to="/privacy">개인정보처리방침</Link>
    </div>
  );
}
