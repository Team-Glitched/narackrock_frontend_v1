import { useEffect, useEffectEvent, useState, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import { ReportReasons } from "@/features/comments/report-reasons";
import { useNotificationsNavigation } from "@/features/notifications/use-notifications-navigation";
import { postError } from "@/features/posts/post-utils";
import { ApiError } from "@/lib/api/client";
import { getPostShareLink } from "@/lib/api/community";
import { canonicalShareLink } from "@/lib/api/content-link";
import { getOpenSourceShare } from "@/lib/api/open-sources";
import { reportOpenSource, reportPost, reportShort } from "@/lib/api/reports";
import { getShortShareLink } from "@/lib/api/shorts";
import { onScreenAction, requestNative } from "@/lib/native-app";
import type {
  NativeCommonAction,
  NativeContentKind,
  NativeHeader,
  NativeMoreAction,
  NativeScreenAction,
  NativeScreenKind,
  NativeScreens,
  NativeScreenView,
} from "@/lib/native-screens";
import { publicWebOrigin } from "@/lib/public-web-origin";
import { queryScope } from "@/lib/query";
import { shareLink } from "@/lib/share-link";
import { useUrlNavigation } from "./use-url-navigation";

/** The app's id for this history entry: react-router's history index and the path. `replace`
 * navigations (tabs, search queries) keep it, so the native screen keeps its state. */
function screenKey(pathname: string) {
  return `${window.history.state?.idx ?? 0}:${pathname}`;
}

const commonActions: Record<NativeCommonAction["type"], true> = {
  back: true,
  search: true,
  notifications: true,
  chat: true,
  login: true,
  profile: true,
  settings: true,
  refresh: true,
  share: true,
  report: true,
};

function isCommon(action: { type: string }): action is NativeCommonAction {
  return Object.hasOwn(commonActions, action.type);
}

/**
 * Shows this page as the app's native screen `kind` (native/screens) while it is mounted. The page
 * keeps its data and passes the view model; screen-specific actions go to `onAction`. Back, search,
 * header buttons, refresh, share and report are handled here the same way on every page.
 * Renders the web report sheet when needed, so the caller must render the returned node.
 */
export function useNativeScreen<K extends NativeScreenKind>(
  kind: K,
  model: NativeScreens[K]["model"],
  {
    header,
    onAction,
    onBack,
    onSearch,
    path,
    overlay = false,
  }: {
    header: NativeHeader | null;
    /** Screen-specific actions, and `more` for paged lists. */
    onAction?: (action: NativeScreens[K]["action"] | NativeMoreAction) => void;
    /** Default: the previous page, or home. */
    onBack?: () => void;
    /** Default: the search page. */
    onSearch?: () => void;
    /** A native overlay such as the inbox; underlying controllers stay mounted. */
    overlay?: boolean;
    /**
     * The app's entry path; default the location pathname. A page that rewrites its own path with
     * `replace` while it stays open (abyss swipes) passes a fixed path so its native screen keeps its key.
     */
    path?: string;
  },
): ReactNode {
  const { pathname } = useLocation();
  const { to, back, currentPath } = useUrlNavigation();
  const { openNotifications } = useNotificationsNavigation();
  const { requireLogin } = useLoginPrompt();
  const queryClient = useQueryClient();
  const userId = useCurrentUserId();
  const key = `${overlay ? "overlay:" : ""}${screenKey(path ?? pathname)}`;
  const [refreshed, setRefreshed] = useState(0);
  const [report, setReport] = useState<{ kind: NativeContentKind; id: number } | null>(null);

  // Sent only when it changes; the app keeps the last one after the page leaves.
  const snapshot = JSON.stringify({ kind, model, header, refreshed });
  useEffect(() => {
    void requestNative("set-screen", {
      screen: { key, view: JSON.parse(snapshot) as NativeScreenView, overlay },
    });
  }, [key, snapshot, overlay]);
  useEffect(
    () => () => void requestNative("set-screen", { screen: { key, view: null, overlay } }),
    [key, overlay],
  );

  async function share(kind: NativeContentKind, id: number, title: string) {
    try {
      const { shareUrl } = await (kind === "post"
        ? getPostShareLink(id)
        : kind === "short"
          ? getShortShareLink(id)
          : getOpenSourceShare(id));
      await shareLink(title, canonicalShareLink(kind, id, shareUrl, publicWebOrigin()));
    } catch (cause) {
      // The WebView turns alert() into a native dialog.
      window.alert(cause instanceof ApiError ? cause.message : postError(cause));
    }
  }

  function handle(action: NativeCommonAction) {
    switch (action.type) {
      case "back":
        return onBack ? onBack() : back("/");
      case "search":
        return onSearch ? onSearch() : to("/search");
      case "notifications":
        return openNotifications();
      case "chat":
        return to("/chat");
      case "login":
        return to("/login", { state: { returnTo: currentPath } });
      case "profile":
        return to("/profile");
      case "settings":
        return to("/settings");
      case "refresh":
        // Resolves once the active queries refetched, whether or not they succeeded.
        void queryClient
          .invalidateQueries({ queryKey: queryScope(userId) })
          .finally(() => setRefreshed((count) => count + 1));
        return;
      case "share":
        if (requireLogin()) void share(action.kind, action.id, action.title);
        return;
      case "report":
        if (requireLogin()) setReport({ kind: action.kind, id: action.id });
        return;
    }
  }
  const act = useEffectEvent((action: NativeScreenAction<K>) => {
    if (isCommon(action)) handle(action);
    else onAction?.(action as NativeScreens[K]["action"] | NativeMoreAction);
  });
  useEffect(
    () =>
      onScreenAction((event) => {
        if (event.key === key) act(event.action as NativeScreenAction<K>);
      }),
    [key],
  );

  // Dialogs remain native too; no DOM modal is mounted behind the screen.
  return report && userId !== null ? (
    <ReportReasons
      key={`${report.kind}-${report.id}`}
      onSubmit={(reason, description) =>
        report.kind === "post"
          ? reportPost(report.id, reason, description)
          : report.kind === "short"
            ? reportShort(report.id, reason, description)
            : reportOpenSource(report.id, reason, description)
      }
      onDone={() => setReport(null)}
    />
  ) : null;
}
