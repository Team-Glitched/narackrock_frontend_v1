import { uiLabels } from "@/lib/ui-labels";
import { useEffect, useState } from "react";
import { ProfileListSheet, type ProfileListKind } from "./profile-lists";
import { Asset, Avatar, SectionTitle } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { ApiError } from "@/lib/api/client";
import { getProfile, updateProfile, updateProfileImage } from "@/lib/api/profile";
import type { UserProfile } from "@/lib/api/contracts";

function profileErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "프로필을 불러오지 못했습니다.";
}

function useOwnProfile(targetUserId?: number) {
  const currentUserId = useCurrentUserId();
  const userId = targetUserId ?? currentUserId;
  const [result, setResult] = useState<{
    userId: number;
    profile: UserProfile | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (userId == null) return;

    let cancelled = false;

    getProfile(userId)
      .then((profile) => {
        if (!cancelled) {
          setResult({ userId, profile, error: null });
        }
      })
      .catch((cause) => {
        if (!cancelled) {
          setResult({
            userId,
            profile: null,
            error: profileErrorMessage(cause),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const setProfile = (profile: UserProfile) => {
    if (userId != null) {
      setResult({ userId, profile, error: null });
    }
  };

  if (userId == null) {
    return {
      profile: null,
      loading: false,
      error: "로그인이 필요합니다.",
      setProfile,
    };
  }

  if (!result || result.userId !== userId) {
    return {
      profile: null,
      loading: true,
      error: null,
      setProfile,
    };
  }

  return {
    profile: result.profile,
    loading: false,
    error: result.error,
    setProfile,
  };
}

function compactCount(count: number) {
  return count >= 1000 ? `${Number((count / 1000).toFixed(1))}k` : String(count);
}
function ProfileWorks({ title, songs, onOpen }: { title: string; songs: UserProfile["activities"]["participatedShorts"]; onOpen: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  return <section className="profile-works">
    <SectionTitle allLabel={expanded ? "접기" : "모두보기"} onAll={songs.length ? () => setExpanded(current => !current) : undefined}>{title}</SectionTitle>
    {songs.length ? <div className={`song-rail${expanded ? " profile-works-expanded" : ""}`}>
      {songs.map(song => <button className="song-card" key={song.shortId} onClick={() => onOpen(song.shortId)} aria-label={`${song.title} 열기`}>
        <span className="song-art">{song.albumImageUrl ?

          <img src={song.albumImageUrl} alt={`${song.title} 앨범 커버`} /> : <span className="empty-artwork" />}</span>
        <strong>{song.title}</strong>
      </button>)}
    </div> : <p className="profile-empty-work">아직 등록한 곡이 없습니다.</p>}
  </section>;
}

export function ProfileScreen({ go, onOpenShort, userId, onOpenPost }: { userId?: number; go: Navigate; onOpenShort: (id: number) => void; onOpenPost:(id:number)=>void }) {
  const currentUserId = useCurrentUserId();
  const [list,setList]=useState<ProfileListKind|null>(null);
  const own = userId === undefined || userId === currentUserId;
  const { profile, loading, error } = useOwnProfile(userId);

  if (loading) {
    return (
      <div className="profile-state" role="status">
        프로필을 불러오는 중...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="profile-state" role="alert">
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
    <div className="profile-view scroll-content">
      <button
        className="profile-edit-trigger"
        onClick={own ? () => go("edit") : undefined}
        disabled={!own}
        aria-label={own ? "프로필 편집" : "사용자 프로필 사진"}
      >
        <Avatar large src={profile.profileImageUrl} />
      </button>

      <h1>{profile.nickname}</h1>

      <div className="stats">
        <button aria-label="팔로워 목록" onClick={()=>setList("followers")}>
          <strong>팔로워</strong>
          <small>{compactCount(profile.relations.followerCount)}</small>
        </button>
        <button aria-label="팔로잉 목록" onClick={()=>setList("following")}>
          <strong>팔로잉</strong>
          <small>{compactCount(profile.relations.followingCount)}</small>
        </button>
        <button aria-label="작성한 게시글 목록" onClick={()=>setList("articles")}>
          <strong>게시글</strong>
          <small>{compactCount(profile.activities.postCount)}</small>
        </button>
      </div>

      {instruments.length > 0 && (
        <div className="tags">
          {instruments.map((instrument) => (
            <span key={instrument}>{instrument}</span>
          ))}
        </div>
      )}

      <section className="description">
        <h2>소개</h2>
        <p>{profile.explanation || "아직 소개가 없습니다."}</p>
      </section>

      <ProfileWorks title={uiLabels.featuredMusic} songs={[...profile.activities.pinnedShorts].sort((a, b) => a.displayOrder - b.displayOrder)} onOpen={onOpenShort} />
      <ProfileWorks title={uiLabels.participatedMusic} songs={profile.activities.participatedShorts} onOpen={onOpenShort} />
      {list&&<ProfileListSheet kind={list} profile={profile} onClose={()=>setList(null)} onProfile={id=>go("profile",id)} onPost={onOpenPost}/>}
    </div>
  );
}

export function EditProfileScreen({ onSaved }: { onSaved: () => void }) {
  const {
    profile,
    loading,
    error: loadError,
    setProfile,
  } = useOwnProfile();

  if (loading) {
    return (
      <div className="profile-state" role="status">
        프로필을 불러오는 중...
      </div>
    );
  }

  if (loadError || !profile) {
    return (
      <div className="profile-state" role="alert">
        {loadError ?? "프로필이 없습니다."}
      </div>
    );
  }

  return (
    <ProfileForm
      initial={{
        nickname: profile.nickname,
        instrument: profile.primaryInstrument ?? "",
        explanation: profile.explanation ?? "",
        imageUrl: profile.profileImageUrl,
      }}
      submitLabel="프로필 저장"
      onSubmit={async ({
        nickname,
        instrument,
        explanation,
        image,
      }) => {
        const updated = await updateProfile({
          nickname,
          primaryInstrument: instrument,
          explanation,
        });

        const uploaded = image ? await updateProfileImage(image) : null;

        setProfile({
          ...profile,
          ...updated,
          profileImageUrl:
            uploaded?.profileImageUrl ?? profile.profileImageUrl,
        });

        onSaved();
      }}
    />
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
      if (
        cause instanceof ApiError &&
        cause.errorCode === "DUPLICATE_NICKNAME"
      ) {
        setStep(0);
      }

      setError(profileErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="profile-onboarding"
      onSubmit={(event) => {
        void advance(event);
      }}
    >
      <header className="auth-header">
        <Asset name="auth-logo.svg" alt="Narackrock" />
      </header>

      <div className="profile-onboarding-content" key={step}>
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
          <p className="profile-form-error" role="alert">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="profile-onboarding-next"
          disabled={saving}
        >
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
  if (
    !new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "image/gif",
    ]).has(file.type)
  ) {
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
    <div className="edit-view scroll-content">
      <label className="edit-avatar">
        <span className="edit-avatar-visual">
          <Avatar
            large
            src={image?.previewUrl ?? initial.imageUrl}
          />

          <span className="edit-avatar-overlay" aria-hidden>
            <Asset name="profile-photo-shade.svg" className="profile-photo-shade" />
            <Asset name="profile-photo-add.svg" className="profile-photo-add" />
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
        <p className="profile-form-error" role="alert">
          {error}
        </p>
      )}

      <button
        className="profile-save-button"
        disabled={saving}
        onClick={() => void save()}
      >
        {saving ? "저장 중..." : submitLabel}
      </button>

      <a className="profile-privacy-link" href="/privacy">
        개인정보처리방침
      </a>
    </div>
  );
}
