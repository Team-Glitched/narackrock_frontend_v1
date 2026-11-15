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
}: {
  children: ReactNode;
  scrollRef?: React.Ref<ScrollViewInstance>;
}) {
  const { bottomInset } = useScreen();
  return (
    <ScrollView
      ref={scrollRef}
      contentContainerStyle={{ paddingTop: 8, paddingBottom: bottomInset + 24 }}
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
  ...props
}: Omit<FlatListProps<T>, "refreshControl" | "onEndReached"> & {
  hasMore?: boolean;
  /** A next page is loading or failed; `more` is not sent again until the page clears this. */
  busy?: boolean;
}): ReactElement {
  const { act, bottomInset } = useScreen();
  return (
    <FlatList
      {...props}
      contentContainerStyle={[
        { paddingTop: 8, paddingBottom: bottomInset + 24 },
        props.contentContainerStyle,
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
