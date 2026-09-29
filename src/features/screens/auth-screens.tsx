"use client";

import { useEffect, useRef, useState } from "react";
import { Asset } from "@/components/app/shared";
import { decodeGoogleCredential, loadGoogleAccounts, type GoogleCredentialResponse } from "@/features/auth/google-identity";
import { loginWithGoogle } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export type PendingProfileSetup = {
  suggestedNickname: string;
  pictureUrl: string | null;
};

type AuthScreenProps = {
  onAuthenticated: () => void;
  onFirstLogin: (pending: PendingProfileSetup) => void;
};

function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.errorCode === "AUTH_FAILED_GOOGLE") return "Google 계정 인증에 실패했습니다.";
    return error.message || "인증 요청을 처리하지 못했습니다.";
  }
  return error instanceof Error ? error.message : "인증 요청을 처리하지 못했습니다.";
}

export function AuthScreen({ onAuthenticated, onFirstLogin }: AuthScreenProps) {
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
          loginWithGoogle(response.credential).then((result) => {
            if (result.firstLogin) {
              const hints = decodeGoogleCredential(response.credential);
              onFirstLogin({
                suggestedNickname: hints.name?.trim() || result.user.nickname,
                pictureUrl: hints.picture,
              });
              return;
            }
            onAuthenticated();
          }).catch((cause) => {
            setError(authErrorMessage(cause));
          }).finally(() => setBusy(false));
        },
      });
      accounts.id.renderButton(googleButtonRef.current, {
        type: "standard",
        theme: "filled_black",
        size: "large",
        shape: "rectangular",
        text: "continue_with",
        width: Math.min(350, googleButtonRef.current.clientWidth || 350),
        locale: "ko",
      });
    }).catch((cause) => {
      if (!cancelled) setError(authErrorMessage(cause));
    });
    return () => { cancelled = true; };
  }, [clientId, onAuthenticated, onFirstLogin]);

  return <section className="auth-screen auth-screen--login" aria-label="로그인">
    <header className="auth-header"><Asset name="auth-logo.svg" alt="Narackrock" /></header>
    <div className="auth-content">
      <h1>Google로 계속하기</h1>
      <p>처음 방문했다면 프로필을 설정하고,<br />기존 사용자라면 바로 음악을 이어가세요.</p>
      {!clientId && <p className="auth-error" role="alert">Google Client ID가 설정되지 않았습니다.</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className={`google-identity-button ${busy ? "is-busy" : ""}`} ref={googleButtonRef} aria-label="Google로 계속하기" />
    </div>
  </section>;
}
