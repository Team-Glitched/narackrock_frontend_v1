import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import type { NativeChartSong, NativeChartTab } from "../../src/lib/native-screens";
import { SongMenuButton, SongRow, songStatus } from "../ui/cards";
import { AppHeader } from "../ui/header";
import { Button, Chips, ErrorRetry, Status, Touchable } from "../ui/kit";
import { ScreenList } from "../ui/screen";
import { useScreen } from "../ui/screen-context";
import { colors, gutter, type } from "../ui/theme";
import type { ScreenProps } from "./types";

const tabs: { value: NativeChartTab; label: string }[] = [
  { value: "featured", label: "대표 음악" },
  { value: "authored", label: "내 작업물" },
  { value: "participated", label: "내 참가작" },
];

const STAR = "#fbbf24";

/** The web charts page (src/features/home/home-screens.tsx ChartsScreen). */
export function ChartsScreen({ model: chart, header }: ScreenProps<"charts">) {
  const { act } = useScreen();
  const ready = chart.status === "ready";
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenList
        data={ready ? chart.items : []}
        keyExtractor={(song) => String(song.shortId)}
        hasMore={chart.paging !== null}
        busy={chart.paging?.busy || chart.paging?.failure !== null}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.top}>
            <Text style={[type.title, styles.title]} accessibilityRole="header">
              {chart.title}
            </Text>
            {chart.tab && (
              <Chips chips={tabs} value={chart.tab} onChange={(tab) => act({ type: "tab", tab })} />
            )}
            {chart.hint && <Text style={[type.caption, styles.padded]}>{chart.hint}</Text>}
            {chart.notice && (
              <Text accessibilityRole="alert" style={[type.body, styles.notice]}>
                {chart.notice}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          chart.status === "error" ? (
            <ErrorRetry
              message={chart.error ?? songStatus.error}
              onRetry={() => act({ type: "retry" })}
            />
          ) : chart.status === "signed-out" ? (
            <Status>로그인하면 음악 목록을 확인할 수 있습니다.</Status>
          ) : (
            <Status>{chart.status === "loading" ? songStatus.loading : chart.emptyMessage}</Status>
          )
        }
        renderItem={({ item: song }) => (
          <SongRow
            song={song}
            onOpen={() => act({ type: "open-short", shortId: song.shortId })}
            trailing={
              song.star ? (
                <StarButton song={song} disabled={chart.starBusy} />
              ) : chart.menu ? (
                <SongMenuButton song={song} />
              ) : undefined
            }
          />
        )}
        ListFooterComponent={
          ready && chart.paging ? (
            <View style={styles.paging}>
              {chart.paging.failure && <Text style={type.muted}>{chart.paging.failure}</Text>}
              <Button
                label={chart.paging.label}
                tone="secondary"
                busy={chart.paging.busy}
                onPress={() => act({ type: "more" })}
              />
            </View>
          ) : undefined
        }
      />
    </>
  );
}

function StarButton({ song, disabled }: { song: NativeChartSong; disabled: boolean }) {
  const { act } = useScreen();
  const pinned = song.star === "pinned";
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={pinned ? `${song.title} 대표 음악 해제` : `${song.title} 대표 음악 설정`}
      accessibilityState={{ selected: pinned, disabled }}
      disabled={disabled}
      hitSlop={8}
      style={[styles.star, disabled && { opacity: 0.5 }]}
      onPress={() => act({ type: "star", shortId: song.shortId })}
    >
      {/* lucide Star, as on the web. */}
      <Svg
        width={18}
        height={18}
        viewBox="0 0 24 24"
        fill={pinned ? STAR : "none"}
        stroke={pinned ? STAR : colors.muted}
        strokeWidth={1.75}
        strokeLinejoin="round"
      >
        <Path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z" />
      </Svg>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  list: { gap: 16 },
  top: { gap: 16, marginBottom: 4 },
  title: { paddingHorizontal: gutter },
  padded: { paddingHorizontal: gutter },
  notice: {
    marginHorizontal: gutter,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.error,
  },
  star: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  paging: { gap: 8, paddingHorizontal: gutter, paddingTop: 8 },
});
