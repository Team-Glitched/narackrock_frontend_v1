import { StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { AppHeader } from "../../ui/header";
import { Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { PreferenceRow, styles as partStyles } from "./parts";

/** The web settings page (src/features/settings/settings-screen.tsx and pages/settings-page.tsx). */
export function SettingsScreen({ model, header }: ScreenProps<"profile-settings">) {
  const { act } = useScreen();
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenScroll>
        <View style={styles.body}>
          <Text style={styles.title} accessibilityRole="header">
            설정
          </Text>
          <View style={styles.group} accessibilityLabel="숏폼 재생">
            <Text style={styles.groupTitle} accessibilityRole="header">
              숏폼 재생
            </Text>
            <PreferenceRow
              title="숏폼 음소거"
              description="숏폼 화면 상단의 소리 버튼과 같은 설정입니다."
              value={model.muted}
              onChange={(value) => act({ type: "mute", value })}
            />
          </View>
          {model.groups.map((group) => (
            <View key={group.title} style={styles.group} accessibilityLabel={group.title}>
              <Text style={styles.groupTitle} accessibilityRole="header">
                {group.title}
              </Text>
              {group.items.map((item, index) => (
                <Touchable
                  key={item.path}
                  accessibilityRole="button"
                  style={[partStyles.preference, index > 0 && styles.divider]}
                  onPress={() => act({ type: "open", path: item.path })}
                >
                  <View style={partStyles.preferenceCopy}>
                    <Text style={partStyles.preferenceTitle}>{item.label}</Text>
                    <Text style={styles.description}>{item.description}</Text>
                  </View>
                  {/* lucide ChevronRight, as on the web. */}
                  <Svg
                    width={18}
                    height={18}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={colors.fg}
                    strokeWidth={1.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <Path d="m9 18 6-6-6-6" />
                  </Svg>
                </Touchable>
              ))}
            </View>
          ))}
          <Touchable
            accessibilityRole="button"
            style={styles.logout}
            onPress={() => act({ type: "logout" })}
          >
            <Text style={styles.logoutText}>로그아웃</Text>
          </Touchable>
          <Touchable
            accessibilityRole="button"
            style={styles.migration}
            onPress={() => act({ type: "migration" })}
          >
            <Text style={styles.migrationText}>이 기기 데이터 이관·복구</Text>
            {/* lucide ChevronRight (16px), as on the web. */}
            <Svg
              width={16}
              height={16}
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.muted}
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d="m9 18 6-6-6-6" />
            </Svg>
          </Touchable>
        </View>
      </ScreenScroll>
    </>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: gutter, paddingTop: 20 },
  title: { color: colors.fg, fontSize: 20, lineHeight: 32, fontWeight: "700", marginBottom: 32 },
  group: { marginBottom: 32 },
  groupTitle: {
    color: colors.fg,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    letterSpacing: -0.2,
    marginBottom: 12,
  },
  divider: { borderTopWidth: 1, borderTopColor: colors.surface },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  logout: {
    minHeight: 48,
    marginTop: 8,
    paddingVertical: 12,
    justifyContent: "center",
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  logoutText: { color: "#ff8d8d", fontSize: 16, lineHeight: 24, fontWeight: "500" },
  /** The web's `mt-1 flex min-h-11 justify-between border-t py-2.5 text-app-muted`. */
  migration: {
    minHeight: 44,
    marginTop: 4,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: colors.surface,
  },
  migrationText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
