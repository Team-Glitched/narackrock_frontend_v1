"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { decodeGoogleCredential, loadGoogleAccounts, type GoogleCredentialResponse } from "@/features/auth/google-identity";
import { loginWithGoogle, signupWithGoogle } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export type PendingGoogleSignup = {
  credential: string;
  suggestedNickname: string;
  pictureUrl: string | null;
};

type AuthScreenProps = {
  mode: "login" | "signup";
  go: Navigate;
  onAuthenticated: () => void;
  onSignupRequired: (pending: PendingGoogleSignup) => void;
  pendingSignup: PendingGoogleSignup | null;
};

function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "DUPLICATE_NICKNAME") return "이미 사용 중인 이름입니다.";
    if (error.errorCode === "ALREADY_REGISTERED") return "이미 가입된 계정입니다. 로그인 화면을 이용해 주세요.";
    if (error.errorCode === "AUTH_FAILED_GOOGLE") return "Google 계정 인증에 실패했습니다.";
    return error.message || "인증 요청을 처리하지 못했습니다.";
  }
  return error instanceof Error ? error.message : "인증 요청을 처리하지 못했습니다.";
}

function validateProfileImage(file: File): void {
  if (!new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]).has(file.type)) {
    throw new Error("JPG, PNG, WEBP 또는 GIF 이미지를 선택해 주세요.");
  }
  if (file.size > 25 * 1024 * 1024) throw new Error("프로필 이미지는 25MB 이하여야 합니다.");
}

export function AuthScreen({ mode, go, onAuthenticated, onSignupRequired, pendingSignup }: AuthScreenProps) {
  const isLogin = mode === "login";
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [nickname, setNickname] = useState(pendingSignup?.suggestedNickname ?? "");
  const [profileImage, setProfileImage] = useState<{ file: File; previewUrl: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";

  useEffect(() => () => {
    if (profileImage) URL.revokeObjectURL(profileImage.previewUrl);
  }, [profileImage]);

  const completeSignup = useCallback(async (credential: string) => {
    if (!nickname.trim()) {
      setError("사용할 이름을 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signupWithGoogle(credential, nickname, profileImage?.file);
      onAuthenticated();
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
    }
  }, [nickname, onAuthenticated, profileImage]);

  useEffect(() => {
    const element = googleButtonRef.current;
    if (!element || !clientId || (!isLogin && pendingSignup)) return;
    let cancelled = false;
    element.replaceChildren();
    loadGoogleAccounts().then((accounts) => {
      if (cancelled || !googleButtonRef.current) return;
      accounts.id.initialize({
        client_id: clientId,
        callback: (response: GoogleCredentialResponse) => {
          if (isLogin) {
            setBusy(true);
            setError(null);
            loginWithGoogle(response.credential).then(() => onAuthenticated()).catch((cause) => {
              if (cause instanceof ApiError && cause.errorCode === "SIGNUP_REQUIRED") {
                const hints = decodeGoogleCredential(response.credential);
                onSignupRequired({
                  credential: response.credential,
                  suggestedNickname: hints.name ?? "",
                  pictureUrl: hints.picture,
                });
                return;
              }
              setError(authErrorMessage(cause));
            }).finally(() => setBusy(false));
          } else {
            void completeSignup(response.credential);
          }
        },
      });
      accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        shape: "rectangular",
        text: isLogin ? "signin_with" : "signup_with",
        width: Math.min(350, googleButtonRef.current.clientWidth || 350),
        locale: "ko",
      });
    }).catch((cause) => {
      if (!cancelled) setError(authErrorMessage(cause));
    });
    return () => { cancelled = true; };
  }, [clientId, isLogin, pendingSignup, completeSignup, onAuthenticated, onSignupRequired]);

  const title = isLogin ? "다시 만나 반가워요" : <>나만의 음악,<br />여기서 시작해요</>;
  const description = isLogin
    ? <>나락락에 로그인하고<br />당신만의 음악을 이어가세요.</>
    : <>Google 계정으로 가입하고<br />사용할 이름과 사진을 설정해 주세요.</>;

  return <section className={`auth-screen auth-screen--${mode}`} aria-label={isLogin ? "로그인" : "회원가입"}>
    <header className="auth-header"><Asset name="auth-logo.svg" alt="Narackrock" /></header>
    <div className="auth-content">
      <h1>{title}</h1>
      <p>{description}</p>
      {!isLogin && <div className="signup-profile-fields">
        <label><strong>이름</strong><input value={nickname} onChange={(event) => setNickname(event.target.value)} maxLength={30} disabled={busy} placeholder="사용할 이름" /></label>
        <label className="signup-image-picker">
          <span>{profileImage ? <Avatar src={profileImage.previewUrl} /> : pendingSignup?.pictureUrl ? <Avatar src={pendingSignup.pictureUrl} /> : <Avatar />}</span>
          <span><strong>프로필 사진</strong><small>{profileImage ? profileImage.file.name : "선택 사항 · 최대 25MB"}</small></span>
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" disabled={busy} onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = "";
            if (!file) return;
            try {
              validateProfileImage(file);
              setProfileImage(current => {
                if (current) URL.revokeObjectURL(current.previewUrl);
                return { file, previewUrl: URL.createObjectURL(file) };
              });
              setError(null);
            } catch (cause) { setError(authErrorMessage(cause)); }
          }} />
          <b>사진 선택</b>
        </label>
      </div>}
      {!clientId && <p className="auth-error" role="alert">Google Client ID가 설정되지 않았습니다.</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      {pendingSignup && !isLogin
        ? <button className="google-auth-button" disabled={busy} onClick={() => void completeSignup(pendingSignup.credential)}>{busy ? "가입 중..." : "회원가입 완료"}</button>
        : <div className={`google-identity-button ${busy ? "is-busy" : ""}`} ref={googleButtonRef} aria-label={isLogin ? "Google로 로그인" : "Google로 회원가입"} />}
    </div>
    <button className="auth-switch" onClick={() => go(isLogin ? "signup" : "login")}>
      {isLogin ? <>처음 오셨나요? <strong>회원가입</strong></> : <>이미 계정이 있나요? <strong>로그인</strong></>}
    </button>
  </section>;
}
