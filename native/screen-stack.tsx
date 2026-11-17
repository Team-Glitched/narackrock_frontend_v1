import { useMemo, useState, type ComponentType } from "react";
import { StyleSheet, View } from "react-native";

import type {
  NativeScreenAction,
  NativeScreenKind,
  NativeScreenReport,
  NativeScreenView,
  NativeSession,
} from "../src/lib/native-screens";
import { screens } from "./screens";
import type { ScreenProps } from "./screens/types";
import { ContentMenu } from "./ui/content-menu";
import { ScreenContext, type MenuTarget, type ScreenContextValue } from "./ui/screen-context";
import { colors } from "./ui/theme";

/** History entries kept mounted after their page left, so Back restores them with their scroll. */
const KEPT_ENTRIES = 8;

export type ScreenEntry = { key: string; view: NativeScreenView };
export type ScreenStackState = { entries: ScreenEntry[]; current: string | null };

export const emptyStack: ScreenStackState = { entries: [], current: null };

/** Applies a page's report: a view shows (and refreshes) its entry; null leaves it cached but hidden. */
export function reduceStack(
  state: ScreenStackState,
  { key, view }: NativeScreenReport,
): ScreenStackState {
  if (!view) return state.current === key ? { ...state, current: null } : state;
  const others = state.entries.filter((entry) => entry.key !== key);
  return { entries: [...others.slice(-(KEPT_ENTRIES - 1)), { key, view }], current: key };
}

/** The native screens of recent history entries over the WebView; only the current one shows. */
export function ScreenStack({
  stack,
  hidden,
  session,
  origin,
  bottomInset,
  onAction,
}: {
  stack: ScreenStackState;
  /** Another native screen is above this stack (e.g. the notification inbox). */
  hidden: boolean;
  session: NativeSession;
  origin: string;
  bottomInset: number;
  onAction: (key: string, action: NativeScreenAction) => void;
}) {
  return (
    <>
      {stack.entries.map((entry) => (
        <ScreenHost
          key={entry.key}
          entry={entry}
          visible={!hidden && entry.key === stack.current}
          session={session}
          origin={origin}
          bottomInset={bottomInset}
          onAction={onAction}
        />
      ))}
    </>
  );
}

function ScreenHost({
  entry: { key, view },
  visible,
  session,
  origin,
  bottomInset,
  onAction,
}: {
  entry: ScreenEntry;
  visible: boolean;
  session: NativeSession;
  origin: string;
  bottomInset: number;
  onAction: (key: string, action: NativeScreenAction) => void;
}) {
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const context = useMemo<ScreenContextValue>(
    () => ({
      act: (action) => onAction(key, action),
      session,
      uri: (url) => {
        const trimmed = url?.trim();
        return trimmed ? (trimmed.startsWith("/") ? `${origin}${trimmed}` : trimmed) : null;
      },
      openMenu: setMenu,
      bottomInset,
      refreshed: view.refreshed,
    }),
    [key, onAction, session, origin, bottomInset, view.refreshed],
  );
  // The registry pairs each kind with its component; TypeScript cannot follow that through the union.
  const Screen = screens[view.kind] as ComponentType<ScreenProps<NativeScreenKind>>;
  return (
    <View style={[styles.screen, !visible && styles.hidden]}>
      <ScreenContext value={context}>
        <Screen model={view.model} header={view.header} />
        <ContentMenu
          target={visible ? menu : null}
          canReport={menu !== null && menu.ownerId !== session.userId}
          onClose={() => setMenu(null)}
          onChoose={(type, target) =>
            onAction(key, { type, kind: target.kind, id: target.id, title: target.title })
          }
        />
      </ScreenContext>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg },
  hidden: { display: "none" },
});
