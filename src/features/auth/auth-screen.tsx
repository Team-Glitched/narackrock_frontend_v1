import { profileStyles } from "@/styles/profile.styles";
import { cn } from "@/lib/utils";
import { sharedStyles } from "@/styles/shared.styles";
import { useEffect, useRef, useState } from "react";
import { Asset } from "@/components/asset";
import {
  decodeGoogleCredential,
  loadGoogleAccounts,
  type GoogleCredentialResponse,
} from "@/features/auth/google-identity";
import { profileSetupRequired } from "@/features/auth/profile-setup-required";
import { hasSignedInBefore } from "@/features/auth/returning-user";
import { loginWithGoogle } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getProfile } from "@/lib/api/profile";
import { Link } from "react-router";

import type { PendingProfileSetup } from "./profile-setup";

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
  const [returning] = useState(hasSignedInBefore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = import.meta.env?.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";

  useEffect(() => {
    const element = googleButtonRef.current;
    if (!element || !clientId) return;
    let cancelled = false;
    element.replaceChildren();
    loadGoogleAccounts()
      .then((accounts) => {
        if (cancelled || !googleButtonRef.current) return;
        accounts.id.initialize({
          client_id: clientId,
          callback: (response: GoogleCredentialResponse) => {
            setBusy(true);
            setError(null);
            loginWithGoogle(response.credential)
              .then(async (result) => {
                const profile = result.firstLogin ? null : await getProfile(result.user.userId);
                if (profileSetupRequired(result.firstLogin, profile)) {
                  const hints = decodeGoogleCredential(response.credential);
                  onFirstLogin({
                    suggestedNickname: hints.name?.trim() || result.user.nickname,
                    pictureUrl: hints.picture,
                  });
                  return;
                }
                onAuthenticated();
              })
              .catch((cause) => {
                setError(authErrorMessage(cause));
              })
              .finally(() => setBusy(false));
          },
        });
        accounts.id.renderButton(googleButtonRef.current, {
          type: "standard",
          theme: "filled_black",
          size: "large",
          shape: "rectangular",
          text: "signin_with",
          width: Math.min(350, googleButtonRef.current.clientWidth || 350),
          locale: "ko",
        });
      })
      .catch((cause) => {
        if (!cancelled) setError(authErrorMessage(cause));
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, onAuthenticated, onFirstLogin]);

  return (
    <section className={cn(profileStyles.authScreen, "auth-screen--login")} aria-label="로그인">
      <header className={profileStyles.authHeader}>
        <Link to="/" aria-label="나락락 홈으로 이동">
          <Asset name="auth-logo.svg" alt="" />
        </Link>
      </header>
      <div className={profileStyles.authContent}>
        <div className={profileStyles.authIntro}>
          <h1>
            {returning ? (
              "다시 만나 반가워요"
            ) : (
              <>
                나만의 음악,
                <br />
                여기서 시작해요
              </>
            )}
          </h1>
          <p>
            {returning ? (
              <>
                나락락에 로그인하고
                <br />
                당신만의 음악을 이어가세요.
              </>
            ) : (
              <>
                Google 계정 하나로 간편하게 가입하고
                <br />
                나만의 곡을 만들고 나눠보세요.
              </>
            )}
          </p>
        </div>
        {!clientId && (
          <button
            className={profileStyles.googleAuthButton}
            disabled
            title="Google 인증 설정이 필요합니다."
          >
            <Asset name="google-g.svg" />
            Google로 로그인
          </button>
        )}
        {error && (
          <p className={profileStyles.authError} role="alert">
            {error}
          </p>
        )}
        <div
          className={cn(profileStyles.googleIdentityButton, busy ? sharedStyles.isBusy : "")}
          ref={googleButtonRef}
          aria-label="Google로 계속하기"
        />
        <Link className="mt-5 block text-center text-caption text-app-muted underline" to="/privacy">
          개인정보처리방침
        </Link>
      </div>
    </section>
  );
}
