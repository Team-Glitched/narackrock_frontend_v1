import { useEffect } from "react";
import { buttonVariants } from "@/styles/variants";
import { PageState } from "@/components/page-state";
import { useLoginPrompt } from "./login-prompt";

/** Direct protected URLs and in-page notices use the same confirmation as authenticated actions. */
export function SignInRequired({
  children,
  promptOnMount = false,
}: {
  children: React.ReactNode;
  promptOnMount?: boolean;
}) {
  const { requestLogin } = useLoginPrompt();
  useEffect(() => {
    if (promptOnMount) requestLogin();
  }, [promptOnMount, requestLogin]);
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
