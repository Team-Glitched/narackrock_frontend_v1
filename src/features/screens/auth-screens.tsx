"use client";

import { Asset } from "@/components/app/shared";
import type { Navigate } from "@/features/navigation/types";

type AuthScreenProps = {
  mode: "login" | "signup";
  go: Navigate;
  onAuthenticate: () => void;
};

export function AuthScreen({ mode, go, onAuthenticate }: AuthScreenProps) {
  const isLogin = mode === "login";
  const title = isLogin ? "다시 만나 반가워요" : <>나만의 음악,<br />여기서 시작해요</>;
  const description = isLogin
    ? <>나락락에 로그인하고<br />당신만의 음악을 이어가세요.</>
    : <>Google 계정 하나로 간편하게 가입하고<br />나만의 곡을 만들고 나눠보세요.</>;
  const action = isLogin ? "Google로 로그인" : "Google로 회원가입";

  return <section className={`auth-screen auth-screen--${mode}`} aria-label={isLogin ? "로그인" : "회원가입"}>
    <header className="auth-header"><Asset name="auth-logo.svg" alt="Narackrock" /></header>
    <div className="auth-content">
      <h1>{title}</h1>
      <p>{description}</p>
      <button className="google-auth-button" onClick={onAuthenticate}>
        <Asset name="google-g.svg" alt="" />
        <span>{action}</span>
      </button>
    </div>
    <button className="auth-switch" onClick={() => go(isLogin ? "signup" : "login")}>
      {isLogin ? <>처음 오셨나요? <strong>회원가입</strong></> : <>이미 계정이 있나요? <strong>로그인</strong></>}
    </button>
  </section>;
}
