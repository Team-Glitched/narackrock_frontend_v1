import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useLoginPrompt } from "@/features/auth/login-prompt";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import type { NativeHeader, NativeSaved } from "@/lib/native-screens";
import { useSavedLibrary } from "./saved-screen";

type SavedBridgeProps = {
  onOpenPost: (id: number) => void;
  onOpenSong: (id: number) => void;
  onSearch: () => void;
  onBack: () => void;
};

const header: NativeHeader = { left: "back", actions: ["notifications", "chat", "search", "account"] };

/** In the app /saved is drawn natively (native/screens/profile/saved.tsx). */
export function NativeSavedBridge(props: SavedBridgeProps) {
  const userId = useCurrentUserId();
  return userId === null ? (
    <SignedOut {...props} />
  ) : (
    <SavedLibraryBridge key={userId} {...props} />
  );
}

const signedOut: NativeSaved = {
  status: "signed-out",
  kind: "post",
  error: null,
  items: [],
  empty: false,
  menu: null,
  busy: false,
  listBusy: false,
  listError: null,
  more: false,
};

function SignedOut({ onSearch, onBack }: SavedBridgeProps) {
  const { requestLogin } = useLoginPrompt();
  return useNativeScreen("profile-saved", signedOut, {
    header,
    onBack,
    onSearch,
    onAction: (action) => {
      if (action.type === "sign-in") requestLogin();
    },
  });
}

function SavedLibraryBridge({ onOpenPost, onOpenSong, onSearch, onBack }: SavedBridgeProps) {
  const { kind, select, list, visible, menu, setMenu, unsave, busy, error, listError } =
    useSavedLibrary();
  const state = list.state;
  const model: NativeSaved = {
    status: state ? "ready" : "loading",
    kind,
    error,
    items: visible.map(({ id, title, author, imageUrl }) => ({ id, title, author, imageUrl })),
    empty: state !== null && visible.length === 0 && !state.error && state.next === null,
    menu,
    busy,
    listBusy: state?.busy ?? false,
    listError: listError === null ? null : { message: listError, retry: state?.next !== null },
    more: state !== null && !state.error && state.next !== null,
  };
  return useNativeScreen("profile-saved", model, {
    header,
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "kind":
          return select(action.kind);
        case "menu":
          return setMenu(menu === action.id ? null : action.id);
        case "unsave": {
          const item = visible.find((row) => row.id === action.id);
          if (item && !busy && !state?.busy)
            unsave.mutate(item, { onSuccess: () => setMenu(null) });
          return;
        }
        case "open":
          return kind === "post" ? onOpenPost(action.id) : onOpenSong(action.id);
        case "more":
          if (!busy && !state?.busy) list.more();
          return;
        case "sign-in":
          return;
      }
    },
  });
}
