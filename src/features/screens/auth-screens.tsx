"use client";

import { useEffect, useRef, useState } from "react";
import { Asset } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";
import { decodeGoogleCredential, loadGoogleAccounts, type GoogleCredentialResponse } from "@/features/auth/google-identity";
import { loginWithGoogle } from "@/lib/api/auth";
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

export function AuthScreen({ mode, go, onAuthenticated, onSignupRequired }: AuthScreenProps) {
  const isLogin = mode === "login";
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? "";

  useEffect(() => {
    const element = googleButtonRef.current;
    if (!element || !clientId) return;
    let cancelled = false;
    element.replaceChildren();
    loadGoogleAccounts().then((accounts) => {
      if (cancelled || !googleButtonRef.current) return;
      accounts.id.initialize({
        client_id: clientId,
        callback: (response: GoogleCredentialResponse) => {
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
  }, [clientId, isLogin, onAuthenticated, onSignupRequired]);

  const title = isLogin ? "다시 만나 반가워요" : <>나만의 음악,<br />여기서 시작해요</>;
  const description = isLogin
    ? <>나락락에 로그인하고<br />당신만의 음악을 이어가세요.</>
    : <>Google 계정으로 인증한 뒤<br />프로필을 완성해 주세요.</>;

  return <section className={`auth-screen auth-screen--${mode}`} aria-label={isLogin ? "로그인" : "회원가입"}>
    <header className="auth-header"><Asset name="auth-logo.svg" alt="Narackrock" /></header>
    <div className="auth-content">
      <h1>{title}</h1>
      <p>{description}</p>
      {!clientId && <p className="auth-error" role="alert">Google Client ID가 설정되지 않았습니다.</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className={`google-identity-button ${busy ? "is-busy" : ""}`} ref={googleButtonRef} aria-label={isLogin ? "Google로 로그인" : "Google로 회원가입"} />
    </div>
    <button className="auth-switch" onClick={() => go(isLogin ? "signup" : "login")}>
      {isLogin ? <>처음 오셨나요? <strong>회원가입</strong></> : <>이미 계정이 있나요? <strong>로그인</strong></>}
    </button>
  </section>;
}
