import type { ReactNode } from "react";
import { useAuthSession } from "@/features/auth/auth-session";
import { DesignViewport } from "@/components/design-viewport";
import { sharedStyles } from "@/styles/shared.styles";
import { SignInRequired } from "./sign-in-required";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { currentUserId } = useAuthSession();
  if (currentUserId !== null) return children;
  return (
    <DesignViewport>
      <div className={sharedStyles.phoneFrame}>
        <SignInRequired promptOnMount>로그인 후 이용할 수 있는 화면입니다.</SignInRequired>
      </div>
    </DesignViewport>
  );
}
