"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Asset, Avatar, SectionTitle } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { logout } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getProfile, updateProfile, updateProfileImage } from "@/lib/api/profile";
import type { UserProfile } from "@/lib/api/contracts";

function profileErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "프로필을 불러오지 못했습니다.";
}

function useOwnProfile() {
  const userId = useCurrentUserId();
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

export function ProfileScreen({ go }: { go: Navigate }) {
  const { profile, loading, error } = useOwnProfile();

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
        onClick={() => go("edit")}
        aria-label="프로필 편집"
      >
        <Avatar large src={profile.profileImageUrl} />
      </button>

      <h1>{profile.nickname}</h1>

      <div className="stats">
        <span>
          <strong>Follower</strong>
          <small>{profile.relations.followerCount}</small>
        </span>
        <span>
          <strong>Following</strong>
          <small>{profile.relations.followingCount}</small>
        </span>
        <span>
          <strong>Articles</strong>
          <small>{profile.activities.postCount}</small>
        </span>
      </div>

      {instruments.length > 0 && (
        <div className="tags">
          {instruments.map((instrument) => (
            <span key={instrument}>{instrument}</span>
          ))}
        </div>
      )}

      <section className="description">
        <h2>Description</h2>
        <p>{profile.explanation || "아직 소개가 없습니다."}</p>
      </section>

      <section>
        <SectionTitle>내 작업물</SectionTitle>
        <p className="profile-empty-work">
          게시글 {profile.activities.posts.length}개 · 참여한 숏폼{" "}
          {profile.activities.participatedShorts.length}개
        </p>
      </section>

      <button type="button" className="profile-logout" onClick={logout}>
        로그아웃
      </button>
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

function ProfileForm({
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
            <svg viewBox="0 0 48 48" fill="none">
              <path
                d="M9 16.5h7l3-4h10l3 4h7a3 3 0 0 1 3 3v18a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-18a3 3 0 0 1 3-3Z"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <path
                d="m12 36 8-8 6 6 5-5 11 10M31 9h10M36 4v10"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
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

      <Link className="profile-privacy-link" href="/privacy">
        개인정보처리방침
      </Link>
    </div>
  );
}
