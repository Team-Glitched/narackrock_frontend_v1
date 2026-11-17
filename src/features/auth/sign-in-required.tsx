import { useEffect } from "react";
import { buttonVariants } from "@/styles/variants";
import { PageState } from "@/components/page-state";
import { useLoginPrompt } from "./login-prompt";
import { nativeApp } from "@/lib/native-app";
import { NativePageStateBridge } from "@/features/community/native-community-bridge";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";

/** Direct protected URLs and in-page notices use the same confirmation as authenticated actions. */
export function SignInRequired({
  children,
  promptOnMount = false,
}: {
  children: React.ReactNode;
  promptOnMount?: boolean;
}) {
  const { requestLogin } = useLoginPrompt();
  const { to, back } = useUrlNavigation();
  useEffect(() => {
    if (promptOnMount) requestLogin();
  }, [promptOnMount, requestLogin]);
  if (nativeApp())
    return (
      <NativePageStateBridge
        state={{
          message: typeof children === "string" ? children : "로그인 후 이용할 수 있는 화면입니다.",
          tone: "muted",
          createLabel: "로그인",
        }}
        onBack={() => back("/")}
        onSearch={() => to("/search")}
        onCreate={() => requestLogin()}
      />
    );
  return (
    <PageState>
      <span className="grid gap-3">
        <span>{children}</span>
        <button className={buttonVariants({ tone: "primary" })} onClick={() => requestLogin()}>
          로그인
        </button>
      </span>
    </PageState>
  );
}
