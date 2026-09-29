"use client";

import { useEffect, useState } from "react";
import { Asset, Avatar, SectionTitle } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { signupWithGoogle } from "@/lib/api/auth";
import { getProfile, updateProfile, updateProfileImage } from "@/lib/api/profile";
import type { UserProfile } from "@/lib/api/contracts";

function profileErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "프로필을 불러오지 못했습니다.";
}

function useOwnProfile() {
  const userId = useCurrentUserId();
  const [result, setResult] = useState<{ userId: number; profile: UserProfile | null; error: string | null } | null>(null);

  useEffect(() => {
    if (userId == null) return;
    let cancelled = false;
    getProfile(userId).then(result => {
      if (!cancelled) setResult({ userId, profile: result, error: null });
    }).catch(cause => {
      if (!cancelled) setResult({ userId, profile: null, error: profileErrorMessage(cause) });
    });
    return () => { cancelled = true; };
  }, [userId]);

  const setProfile = (profile: UserProfile) => {
    if (userId != null) setResult({ userId, profile, error: null });
  };
  if (userId == null) return { profile: null, loading: false, error: "로그인이 필요합니다.", setProfile };
  if (!result || result.userId !== userId) return { profile: null, loading: true, error: null, setProfile };
  return { profile: result.profile, loading: false, error: result.error, setProfile };
}

export function ProfileScreen({ go }: { go: Navigate }) {
  const { profile, loading, error } = useOwnProfile();
  if (loading) return <div className="profile-state" role="status">프로필을 불러오는 중...</div>;
  if (error || !profile) return <div className="profile-state" role="alert">{error ?? "프로필이 없습니다."}</div>;
  const instruments = profile.primaryInstrument?.split(",").map(item => item.trim()).filter(Boolean) ?? [];
  return <div className="profile-view scroll-content">
    <button className="profile-edit-trigger" onClick={() => go("edit")} aria-label="프로필 편집"><Avatar large src={profile.profileImageUrl} /></button>
    <h1>{profile.nickname}</h1>
    <div className="stats"><span><strong>Follower</strong><small>{profile.relations.followerCount}</small></span><span><strong>Following</strong><small>{profile.relations.followingCount}</small></span><span><strong>Articles</strong><small>{profile.activities.postCount}</small></span></div>
    {instruments.length > 0 && <div className="tags">{instruments.map(instrument => <span key={instrument}>{instrument}</span>)}</div>}
    <section className="description"><h2>Description</h2><p>{profile.explanation || "아직 소개가 없습니다."}</p></section>
    <section><SectionTitle>내 작업물</SectionTitle><p className="profile-empty-work">게시글 {profile.activities.posts.length}개 · 참여한 숏폼 {profile.activities.participatedShorts.length}개</p></section>
  </div>;
}

export function EditProfileScreen({ onSaved }: { onSaved: () => void }) {
  const { profile, loading, error: loadError, setProfile } = useOwnProfile();

  if (loading) return <div className="profile-state" role="status">프로필을 불러오는 중...</div>;
  if (loadError || !profile) return <div className="profile-state" role="alert">{loadError ?? "프로필이 없습니다."}</div>;
  return <ProfileForm
    initial={{ nickname: profile.nickname, instrument: profile.primaryInstrument ?? "", explanation: profile.explanation ?? "", imageUrl: profile.profileImageUrl }}
    submitLabel="프로필 저장"
    onSubmit={async ({ nickname, instrument, explanation, image }) => {
      const updated = await updateProfile({ nickname, primaryInstrument: instrument, explanation });
      const uploaded = image ? await updateProfileImage(image) : null;
      setProfile({ ...profile, ...updated, profileImageUrl: uploaded?.profileImageUrl ?? profile.profileImageUrl });
      onSaved();
    }}
  />;
}

export function InitialProfileSetupScreen({ credential, suggestedNickname, pictureUrl, onSaved }: {
  credential: string;
  suggestedNickname: string;
  pictureUrl: string | null;
  onSaved: () => void;
}) {
  const [accountCreated, setAccountCreated] = useState(false);
  return <ProfileForm
    initial={{ nickname: suggestedNickname, instrument: "", explanation: "", imageUrl: pictureUrl }}
    submitLabel="가입하고 시작하기"
    onSubmit={async ({ nickname, instrument, explanation, image }) => {
      if (!accountCreated) {
        await signupWithGoogle(credential, nickname);
        setAccountCreated(true);
      }
      await updateProfile({ nickname, primaryInstrument: instrument, explanation });
      if (image) await updateProfileImage(image);
      onSaved();
    }}
  />;
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
  if (file.size > 25 * 1024 * 1024) throw new Error("프로필 이미지는 25MB 이하여야 합니다.");
}

function ProfileForm({ initial, submitLabel, onSubmit }: {
  initial: { nickname: string; instrument: string; explanation: string; imageUrl: string | null };
  submitLabel: string;
  onSubmit: (draft: ProfileDraft) => Promise<void>;
}) {
  const [nickname, setNickname] = useState(initial.nickname);
  const [instrument, setInstrument] = useState(initial.instrument);
  const [explanation, setExplanation] = useState(initial.explanation);
  const [image, setImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (image) URL.revokeObjectURL(image.previewUrl);
  }, [image]);

  async function save() {
    if (!nickname.trim()) { setError("이름을 입력해 주세요."); return; }
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ nickname: nickname.trim(), instrument: instrument.trim(), explanation: explanation.trim(), image: image?.file ?? null });
    } catch (cause) {
      setError(profileErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return <div className="edit-view scroll-content">
    <label className="edit-avatar">
      <Avatar large src={image?.previewUrl ?? initial.imageUrl} /><span><Asset name="photo-add.svg" /></span>
      <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={saving} onChange={(event) => {
        const file = event.currentTarget.files?.[0];
        event.currentTarget.value = "";
        if (!file) return;
        try {
          validateProfileImage(file);
          setImage(current => {
            if (current) URL.revokeObjectURL(current.previewUrl);
            return { file, previewUrl: URL.createObjectURL(file) };
          });
          setError(null);
        } catch (cause) { setError(profileErrorMessage(cause)); }
      }} />
    </label>
    <label><strong>이름</strong><input value={nickname} onChange={event => setNickname(event.target.value)} maxLength={30} disabled={saving} /></label>
    <label><strong>악기</strong><input value={instrument} onChange={event => setInstrument(event.target.value)} disabled={saving} placeholder="예: Guitar, Piano" /></label>
    <label><strong>설명</strong><textarea value={explanation} onChange={event => setExplanation(event.target.value)} disabled={saving} /></label>
    {error && <p className="profile-form-error" role="alert">{error}</p>}
    <button className="profile-save-button" disabled={saving} onClick={() => void save()}>{saving ? "저장 중..." : submitLabel}</button>
  </div>;
}
