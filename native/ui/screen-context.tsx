import { createContext, useContext } from "react";

import type {
  NativeContentKind,
  NativeScreenAction,
  NativeSession,
} from "../../src/lib/native-screens";

export type MenuTarget = { kind: NativeContentKind; id: number; title: string; ownerId: number };

export type ScreenContextValue = {
  /** Sends an action to this screen's web page. */
  act: (action: NativeScreenAction) => void;
  session: NativeSession;
  /** Absolute URL for an image: legacy relative /files/... paths go through the bundled web server. */
  uri: (url: string | null | undefined) => string | null;
  /** Opens the share/report sheet of a card. */
  openMenu: (target: MenuTarget) => void;
  /** Space kept free at the bottom for the tab bar. */
  bottomInset: number;
  /** Completed refreshes reported by the page (`NativeScreenView.refreshed`). */
  refreshed: number;
};

export const ScreenContext = createContext<ScreenContextValue | null>(null);

export function useScreen(): ScreenContextValue {
  const value = useContext(ScreenContext);
  if (!value) throw new Error("useScreen must be used inside a native screen.");
  return value;
}
