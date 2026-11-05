import { useLocation, useNavigate } from "react-router";
import { buttonVariants } from "@/styles/variants";
import { PageState } from "@/components/page-state";

/** In-page notice for server features that need a session; returns to the current local URL after login. */
export function SignInRequired({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <PageState>
      <span className="grid gap-3">
        <span>{children}</span>
        <button
          className={buttonVariants({ tone: "primary" })}
          onClick={() =>
            navigate("/login", {
              state: { returnTo: location.pathname + location.search, from: location.pathname + location.search },
            })
          }
        >
          로그인
        </button>
      </span>
    </PageState>
  );
}
