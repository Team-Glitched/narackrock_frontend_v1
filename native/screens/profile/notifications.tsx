import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import BellIcon from "../../../public/figma/bell.svg";
import type {
  NativeNotificationItem,
  NativeNotificationPreferences,
} from "../../../src/lib/native-screens";
import { MenuSheet, type MenuItem } from "../../ui/comments";
import { AppHeader } from "../../ui/header";
import { Button, MoreButton, Touchable } from "../../ui/kit";
import { ScreenList } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { FilterChip, PreferenceRow } from "./parts";

const RED = "#fca5a5";

/** The web notification inbox (src/features/notifications/notifications-screen.tsx). */
export function NotificationsScreen({ model, header }: ScreenProps<"profile-notifications">) {
  const { act } = useScreen();
  const [headerMenu, setHeaderMenu] = useState(false);
  const ready = model.signedIn && model.status === "ready";
  const headerItems: MenuItem[] = [
    ...(!model.readAllDisabled ? [{ label: "모두 읽음", onPress: () => act({ type: "read-all" }) }] : []),
    ...(!model.deleteReadDisabled
      ? [{ label: "읽은 알림 모두 삭제", onPress: () => act({ type: "delete-read" }) }]
      : []),
    { label: "알림 수신 설정", onPress: () => act({ type: "toggle-preferences" }) },
  ];
  return (
    <>
      {header && <AppHeader header={header} />}
      <MenuSheet
        label="알림 옵션"
        items={headerItems}
        visible={headerMenu}
        onClose={() => setHeaderMenu(false)}
      />
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
                <MoreButton
                  label="알림 옵션"
                  style={styles.moreButton}
                  onPress={() => setHeaderMenu(true)}
                />
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
  const [menu, setMenu] = useState(false);
  const menuItems: MenuItem[] = [
    ...(item.link
      ? [
          {
            label: item.link === "project" ? "전체 트랙 보기" : "자세히 보기",
            onPress: () => act({ type: item.link === "project" ? "project" : "open", id: item.id }),
          },
        ]
      : []),
    ...(item.unread ? [{ label: "읽음 표시", onPress: () => act({ type: "read", id: item.id }) }] : []),
  ];
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
        <View style={styles.rowMeta}>
          <Text style={type.caption}>{item.time}</Text>
          {menuItems.length > 0 && !busy && (
            <MoreButton
              label="알림 더보기"
              style={styles.moreButton}
              onPress={() => setMenu(true)}
            />
          )}
        </View>
      </View>
      <MenuSheet
        label="알림 항목 옵션"
        items={menuItems}
        visible={menu}
        onClose={() => setMenu(false)}
      />
      <Touchable
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        disabled={busy}
        onPress={() => act({ type: "open", id: item.id })}
      >
        <Text style={styles.body}>{item.body}</Text>
      </Touchable>
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
  moreButton: { width: 32, height: 32 },
  categories: { gap: 8, paddingHorizontal: gutter },
  filters: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
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
    borderColor: "transparent",
    backgroundColor: colors.surface,
  },
  rowTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  rowTitle: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#f87171" },
  body: { color: colors.fg, fontSize: 14, lineHeight: 24 },
  review: { flexDirection: "row", gap: 8, marginTop: 12 },
  compact: { minHeight: 36, paddingHorizontal: 14 },
  status: { marginTop: 8 },
});
