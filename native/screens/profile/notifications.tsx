import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import BellIcon from "../../../public/figma/bell.svg";
import type {
  NativeNotificationItem,
  NativeNotificationPreferences,
} from "../../../src/lib/native-screens";
import { AppHeader } from "../../ui/header";
import { Button, Touchable } from "../../ui/kit";
import { ScreenList } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { FilterChip, PreferenceRow, styles as partStyles } from "./parts";

const RED = "#fca5a5";

/** The web notification inbox (src/features/notifications/notifications-screen.tsx). */
export function NotificationsScreen({ model, header }: ScreenProps<"profile-notifications">) {
  const { act } = useScreen();
  const ready = model.signedIn && model.status === "ready";
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenList
        data={model.signedIn ? model.items : []}
        keyExtractor={(item) => String(item.id)}
        hasMore={model.paging !== null}
        busy={model.paging?.busy ?? false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.top}>
            <View style={styles.titleRow}>
              <View style={styles.titleGroup}>
                <Text style={type.title} accessibilityRole="header">
                  알림
                </Text>
                {model.unreadCount > 0 && <Text style={styles.count}>{model.unreadCount}</Text>}
              </View>
              {model.signedIn && (
                <Touchable
                  accessibilityRole="button"
                  accessibilityLabel="알림 수신 설정"
                  accessibilityState={{ expanded: model.preferences !== null }}
                  style={styles.settings}
                  onPress={() => act({ type: "toggle-preferences" })}
                >
                  <SettingsIcon />
                </Touchable>
              )}
            </View>
            {!model.signedIn ? (
              <Text style={type.body}>로그인 후 알림을 확인할 수 있습니다.</Text>
            ) : (
              <>
                {model.preferences && <Preferences preferences={model.preferences} />}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.unpad}
                  contentContainerStyle={styles.categories}
                  accessibilityLabel="알림 종류"
                >
                  {model.categories.map((category) => (
                    <FilterChip
                      key={category.id ?? "all"}
                      label={category.label}
                      pressed={model.category === category.id}
                      onPress={() => act({ type: "category", id: category.id })}
                    />
                  ))}
                </ScrollView>
                <View style={styles.filters}>
                  <FilterChip
                    label="미확인만 보기"
                    pressed={model.unreadOnly}
                    onPress={() => act({ type: "unread-only" })}
                  />
                  <Touchable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: model.readAllDisabled }}
                    disabled={model.readAllDisabled}
                    style={[styles.readAll, model.readAllDisabled && partStyles.disabled]}
                    onPress={() => act({ type: "read-all" })}
                  >
                    <CheckIcon />
                    <Text style={type.muted}>모두 읽음</Text>
                  </Touchable>
                </View>
                {model.error && (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {model.error}
                  </Text>
                )}
                {model.notice && <Text style={type.muted}>{model.notice}</Text>}
                {model.status === "loading" && (
                  <Text style={[type.muted, styles.loading]}>알림을 불러오는 중...</Text>
                )}
                {model.status === "error" && (
                  <View style={styles.listError} accessibilityRole="alert">
                    <Text style={type.muted}>알림을 불러오지 못했습니다.</Text>
                    <Button
                      label="다시 시도"
                      tone="secondary"
                      onPress={() => act({ type: "retry" })}
                    />
                  </View>
                )}
              </>
            )}
          </View>
        }
        renderItem={({ item }) => <Row item={item} busy={model.busy} />}
        ListFooterComponent={
          <>
            {ready && model.items.length === 0 && (
              <View style={styles.empty}>
                <BellIcon width={30} height={30} />
                <Text style={type.muted}>{model.emptyMessage}</Text>
              </View>
            )}
            {model.signedIn && model.paging && (
              <Button
                label={model.paging.busy ? "불러오는 중..." : "이전 알림 더 보기"}
                tone="secondary"
                disabled={model.paging.busy}
                style={styles.more}
                onPress={() => act({ type: "more" })}
              />
            )}
          </>
        }
      />
    </>
  );
}

function Preferences({ preferences }: { preferences: NativeNotificationPreferences }) {
  const { act } = useScreen();
  return (
    <View style={styles.preferences} accessibilityLabel="알림 수신 설정">
      <Text style={type.label}>알림 수신 설정</Text>
      <Text style={[type.muted, styles.preferencesHint]}>
        요청·처리 결과와 댓글, 운영 안내는 항상 알립니다.
      </Text>
      {preferences.status === "loading" && <Text style={type.body}>설정을 불러오는 중...</Text>}
      {preferences.status === "error" && (
        <View style={styles.preferencesError} accessibilityRole="alert">
          <Text style={type.body}>설정을 불러오지 못했습니다.</Text>
          <Touchable accessibilityRole="button" onPress={() => act({ type: "preferences-retry" })}>
            <Text style={[type.body, styles.underline]}>다시 시도</Text>
          </Touchable>
        </View>
      )}
      {preferences.options.map((option) => (
        <View key={option.key} style={styles.preferenceDivider}>
          <PreferenceRow
            title={option.title}
            description={option.description}
            value={option.value}
            disabled={preferences.saving}
            onChange={(value) => act({ type: "preference", key: option.key, value })}
          />
        </View>
      ))}
      {preferences.saving && <Text style={type.caption}>저장 중...</Text>}
      {preferences.saved && <Text style={type.caption}>설정을 저장했습니다.</Text>}
      {preferences.failed && (
        <Text accessibilityRole="alert" style={[type.caption, { color: RED }]}>
          설정을 저장하지 못했습니다. 다시 선택해 주세요.
        </Text>
      )}
    </View>
  );
}

function Row({ item, busy }: { item: NativeNotificationItem; busy: boolean }) {
  const { act } = useScreen();
  return (
    <View style={[styles.row, item.unread ? styles.rowUnread : styles.rowRead]}>
      <View style={styles.rowTop}>
        <View style={styles.rowTitle}>
          {item.unread && <View accessibilityLabel="미확인" style={styles.dot} />}
          <Text style={[type.label, styles.shrink]} numberOfLines={2}>
            {item.title}
            {item.countLabel && ` ${item.countLabel}`}
          </Text>
        </View>
        <Text style={type.caption}>{item.time}</Text>
      </View>
      <Touchable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => act({ type: "open", id: item.id })}
      >
        <Text style={styles.body}>{item.body}</Text>
      </Touchable>
      <View style={styles.rowActions}>
        {item.link ? (
          <Touchable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            style={styles.link}
            onPress={() => act({ type: item.link === "project" ? "project" : "open", id: item.id })}
          >
            <Text style={styles.linkText}>
              {item.link === "project" ? "전체 트랙 보기" : "자세히 보기"}
            </Text>
            <ArrowIcon />
          </Touchable>
        ) : (
          <View />
        )}
        {item.unread && (
          <Touchable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            style={styles.readButton}
            onPress={() => act({ type: "read", id: item.id })}
          >
            <Text style={type.muted}>읽음 표시</Text>
          </Touchable>
        )}
      </View>
      {item.pending ? (
        <View style={styles.review} accessibilityLabel="요청 처리">
          <Button
            label="수락"
            disabled={busy}
            style={styles.compact}
            onPress={() => act({ type: "review", id: item.id, accept: true })}
          />
          <Button
            label="거절"
            tone="secondary"
            disabled={busy}
            style={styles.compact}
            onPress={() => act({ type: "review", id: item.id, accept: false })}
          />
        </View>
      ) : (
        item.statusLabel && <Text style={[type.muted, styles.status]}>{item.statusLabel}</Text>
      )}
    </View>
  );
}

/** lucide Settings2, as on the web. */
function SettingsIcon() {
  return (
    <Svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.fg}
      strokeWidth={2}
      strokeLinecap="round"
    >
      <Path d="M20 7h-9" />
      <Path d="M14 17H5" />
      <Circle cx={17} cy={17} r={3} />
      <Circle cx={7} cy={7} r={3} />
    </Svg>
  );
}

/** lucide Check. */
function CheckIcon() {
  return (
    <Svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors.muted}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

/** lucide ArrowUpRight. */
function ArrowIcon() {
  return (
    <Svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke={colors["primary-soft"]}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Line x1={7} y1={17} x2={17} y2={7} />
      <Path d="M7 7h10v10" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  shrink: { flexShrink: 1 },
  list: { paddingHorizontal: gutter },
  top: { gap: 12, marginBottom: 8 },
  unpad: { marginHorizontal: -gutter },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleGroup: { flexDirection: "row", alignItems: "center", gap: 8 },
  count: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: "hidden",
    color: RED,
    fontSize: 12,
    fontWeight: "600",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  settings: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  categories: { gap: 8, paddingHorizontal: gutter },
  filters: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  readAll: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 4 },
  error: {
    padding: 12,
    borderRadius: 12,
    overflow: "hidden",
    color: RED,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
  },
  loading: { paddingVertical: 40, textAlign: "center" },
  listError: { alignItems: "center", gap: 12, paddingVertical: 32 },
  empty: { alignItems: "center", gap: 12, paddingVertical: 64 },
  more: { marginTop: 4 },
  preferences: {
    marginBottom: 4,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  preferencesHint: { marginTop: 4, marginBottom: 12 },
  preferencesError: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  underline: { textDecorationLine: "underline" },
  preferenceDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  row: { padding: 16, borderRadius: 16, borderWidth: 1, marginBottom: 12 },
  rowUnread: {
    borderColor: "rgba(167, 139, 250, 0.2)",
    backgroundColor: "rgba(167, 139, 250, 0.06)",
  },
  rowRead: {
    borderColor: "rgba(255, 255, 255, 0.06)",
    backgroundColor: "rgba(255, 255, 255, 0.015)",
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 8,
  },
  rowTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#f87171" },
  body: { color: colors.fg, fontSize: 14, lineHeight: 24 },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 12,
  },
  link: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 4 },
  linkText: { color: colors["primary-soft"], fontSize: 14 },
  readButton: { minHeight: 36, justifyContent: "center" },
  review: { flexDirection: "row", gap: 8, marginTop: 8 },
  compact: { minHeight: 36, paddingHorizontal: 14 },
  status: { marginTop: 8 },
});
