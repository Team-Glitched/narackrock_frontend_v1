import { useState, type ReactElement, type ReactNode } from "react";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  type FlatListProps,
  type ScrollViewInstance,
} from "react-native";

import { useScreen } from "./screen-context";
import { colors } from "./theme";

/** Room under the content: the tab bar, plus the floating create button when there is one. */
function useBottomPadding(fab: boolean) {
  return useScreen().bottomInset + (fab ? 90 : 24);
}

/** Pull-to-refresh driven by the page: the spinner runs until the page reports the refresh done. */
function useRefresh() {
  const { act, refreshed } = useScreen();
  const [target, setTarget] = useState<number | null>(null);
  return (
    <RefreshControl
      refreshing={target !== null && refreshed < target}
      tintColor={colors.fg}
      colors={[colors.primary]}
      progressBackgroundColor={colors.surface}
      onRefresh={() => {
        setTarget(refreshed + 1);
        act({ type: "refresh" });
      }}
    />
  );
}

/** Scrollable screen body with pull-to-refresh and room for the tab bar. */
export function ScreenScroll({
  children,
  scrollRef,
  fab = false,
}: {
  children: ReactNode;
  scrollRef?: React.Ref<ScrollViewInstance>;
  /** Keeps the last content clear of a floating button. */
  fab?: boolean;
}) {
  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: useBottomPadding(fab) }}
      keyboardShouldPersistTaps="handled"
      refreshControl={useRefresh()}
    >
      {children}
    </ScrollView>
  );
}

/**
 * Vertical list screen body with pull-to-refresh; reaching the end sends `more` while the page
 * reports `hasMore`.
 */
export function ScreenList<T>({
  hasMore = false,
  busy = false,
  fab = false,
  ...props
}: Omit<FlatListProps<T>, "refreshControl" | "onEndReached"> & {
  hasMore?: boolean;
  /** A next page is loading or failed; `more` is not sent again until the page clears this. */
  busy?: boolean;
  /** Keeps the last row clear of a floating button. */
  fab?: boolean;
}): ReactElement {
  const { act } = useScreen();
  return (
    <FlatList
      {...props}
      contentContainerStyle={[
        props.contentContainerStyle,
        { paddingTop: 8, paddingBottom: useBottomPadding(fab) },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={useRefresh()}
      onEndReachedThreshold={0.5}
      onEndReached={() => {
        if (hasMore && !busy) act({ type: "more" });
      }}
    />
  );
}
