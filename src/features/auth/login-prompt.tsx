import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useBlocker, useLocation, useNavigate } from "react-router";
import { getCurrentUserId } from "@/lib/api/client";
import { buttonVariants } from "@/styles/variants";
import { useAuthSession } from "./auth-session";
import { loginDestination, requiresLogin } from "./login-access";

type LoginRequest = { returnTo: string; from: string; locationKey: string };
type LoginPrompt = {
  requestLogin: (returnTo?: string) => void;
  requireLogin: (returnTo?: string) => boolean;
};
const LoginPromptContext = createContext<LoginPrompt | null>(null);

export function useLoginPrompt() {
  const value = useContext(LoginPromptContext);
  if (!value) throw new Error("LoginPromptProvider가 필요합니다.");
  return value;
}

export function LoginPromptProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUserId } = useAuthSession();
  const currentPath = location.pathname + location.search + location.hash;
  const [request, setRequest] = useState<LoginRequest | null>(null);
  // This also covers Link, browser Back/Forward and navigation outside useUrlNavigation.
  const blocker = useBlocker(
    ({ nextLocation }) =>
      getCurrentUserId() === null && requiresLogin(nextLocation.pathname + nextLocation.search),
  );
  const requestLogin = useCallback(
    (returnTo = currentPath) => {
      setRequest({ ...loginDestination(returnTo, currentPath), locationKey: location.key });
    },
    [currentPath, location.key],
  );
  const requireLogin = useCallback(
    (returnTo?: string) => {
      if (getCurrentUserId() !== null) return true;
      requestLogin(returnTo);
      return false;
    },
    [requestLogin],
  );
  const activeRequest =
    blocker.state === "blocked"
      ? loginDestination(
          blocker.location.pathname + blocker.location.search + blocker.location.hash,
          currentPath,
        )
      : request?.locationKey === location.key
        ? request
        : null;
  function dismiss() {
    setRequest(null);
    if (blocker.state === "blocked") blocker.reset();
  }
  return (
    <LoginPromptContext value={{ requestLogin, requireLogin }}>
      {children}
      {currentUserId === null && activeRequest && (
        <LoginConfirmation
          onCancel={dismiss}
          onConfirm={() => {
            const state = loginDestination(activeRequest.returnTo, activeRequest.from);
            dismiss();
            navigate("/login", { state });
          }}
        />
      )}
    </LoginPromptContext>
  );
}

function LoginConfirmation({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.showModal();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  // A native modal uses the top layer, including over comment sheets and the landscape studio canvas.
  return createPortal(
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-modal="true"
      className="fixed inset-0 m-auto w-[calc(100%_-_32px)] max-w-[360px] rounded-panel border border-app-border bg-app-surface p-6 text-app-fg shadow-xl backdrop:bg-black/65"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onCancel();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <h2 id={titleId} className="text-title font-bold">
        로그인이 필요합니다
      </h2>
      <p id={descriptionId} className="mt-3 text-body text-app-muted">
        로그인하시겠습니까?
      </p>
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" className={buttonVariants({ tone: "secondary" })} onClick={onCancel}>
          아니오
        </button>
        <button type="button" className={buttonVariants({ tone: "primary" })} onClick={onConfirm}>
          예
        </button>
      </div>
    </dialog>,
    document.body,
  );
}
