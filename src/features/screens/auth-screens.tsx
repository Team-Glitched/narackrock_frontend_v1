import { useEffect, useRef, useState } from "react";
import { Asset } from "@/components/app/shared";
import { decodeGoogleCredential, loadGoogleAccounts, type GoogleCredentialResponse } from "@/features/auth/google-identity";
import { profileSetupRequired } from "@/features/auth/profile-setup-required";
import { loginWithGoogle } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { getProfile } from "@/lib/api/profile";

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
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clientId = import.meta.env?.VITE_GOOGLE_CLIENT_ID?.trim() ?? "";

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
          loginWithGoogle(response.credential).then(async (result) => {
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
        text: signup ? "signup_with" : "signin_with",
        width: Math.min(350, googleButtonRef.current.clientWidth || 350),
        locale: "ko",
      });
    }).catch((cause) => {
      if (!cancelled) setError(authErrorMessage(cause));
    });
    return () => { cancelled = true; };
  }, [clientId, signup, onAuthenticated, onFirstLogin]);

  return <section className="auth-screen auth-screen--login" aria-label="로그인">
    <header className="auth-header"><Asset name="auth-logo.svg" alt="Narackrock" /></header>
    <div className="auth-content">
      <div className="auth-intro"><h1>{signup ? <>나만의 음악,<br />여기서 시작해요</> : "다시 만나 반가워요"}</h1><p>{signup ? <>Google 계정 하나로 간편하게 가입하고<br />나만의 곡을 만들고 나눠보세요.</> : <>나락락에 로그인하고<br />당신만의 음악을 이어가세요.</>}</p></div>
      {!clientId && <button className="google-auth-button" disabled title="Google 인증 설정이 필요합니다."><Asset name="google-g.svg" />Google로 {signup ? "회원가입" : "로그인"}</button>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <div className={`google-identity-button ${busy ? "is-busy" : ""}`} ref={googleButtonRef} aria-label="Google로 계속하기" />
    </div>
    <button className="auth-switch" onClick={() => setSignup(current => !current)}>{signup ? "이미 계정이 있나요? 로그인" : "처음 오셨나요? 회원가입"}</button>
  </section>;
}
