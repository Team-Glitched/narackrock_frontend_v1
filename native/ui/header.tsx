import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import ChatIcon from "../../public/figma/abyss-comment.svg";
import Logo from "../../public/figma/auth-logo.svg";
import BackIcon from "../../public/figma/return.svg";
import SettingsIcon from "../../public/figma/settings.svg";
import BellIcon from "../../public/figma/v3-bell.svg";
import SearchIcon from "../../public/figma/v3-search.svg";
import type { NativeHeader } from "../../src/lib/native-screens";
import { Avatar, Touchable } from "./kit";
import { useScreen } from "./screen-context";
import { colors, type } from "./theme";

/** The web Header (src/features/navigation/header.tsx) drawn natively from the session. */
export function AppHeader({ header, onLogo }: { header: NativeHeader; onLogo?: () => void }) {
  const { act, session, uri } = useScreen();
  const signedIn = session.userId !== null;
  return (
    <View style={[styles.header, header.left === "back" && styles.headerBack]}>
      {header.left === "logo" && (
        <Touchable accessibilityRole="button" accessibilityLabel="맨 위로" onPress={onLogo}>
          <Logo width={68} height={43} />
        </Touchable>
      )}
      {header.left === "back" && (
        <HeaderButton label="뒤로" onPress={() => act({ type: "back" })}>
          <BackIcon width={22} height={22} />
        </HeaderButton>
      )}
      <Text style={[type.label, styles.title]} numberOfLines={1} accessibilityRole="header">
        {header.title ?? ""}
      </Text>
      <View style={styles.actions}>
        {header.actions.map((action) => {
          switch (action) {
            case "notifications":
              return (
                <HeaderButton
                  key={action}
                  label={
                    session.unreadNotifications
                      ? `알림, 미확인 ${session.unreadNotifications}개`
                      : "알림"
                  }
                  count={session.unreadNotifications}
                  onPress={() => act({ type: "notifications" })}
                >
                  <BellIcon width={22} height={26} />
                </HeaderButton>
              );
            case "chat":
              return signedIn ? (
                <HeaderButton
                  key={action}
                  label={
                    session.unreadChats
                      ? `대화 목록, 읽지 않은 메시지 ${session.unreadChats}개`
                      : "대화 목록"
                  }
                  count={session.unreadChats}
                  onPress={() => act({ type: "chat" })}
                >
                  <ChatIcon width={20} height={20} />
                </HeaderButton>
              ) : null;
            case "search":
              return (
                <HeaderButton key={action} label="검색" onPress={() => act({ type: "search" })}>
                  <SearchIcon width={24} height={24} />
                </HeaderButton>
              );
            case "account":
            case "settings":
              return !signedIn ? (
                <Touchable
                  key={action}
                  accessibilityRole="button"
                  style={styles.login}
                  onPress={() => act({ type: "login" })}
                >
                  <Text style={styles.loginText}>로그인</Text>
                </Touchable>
              ) : action === "settings" ? (
                <HeaderButton key={action} label="설정" onPress={() => act({ type: "settings" })}>
                  <SettingsIcon width={24} height={24} />
                </HeaderButton>
              ) : (
                <HeaderButton key={action} label="프로필" onPress={() => act({ type: "profile" })}>
                  <Avatar uri={uri(session.profileImageUrl)} size={32} />
                </HeaderButton>
              );
          }
        })}
      </View>
    </View>
  );
}

export function HeaderButton({
  label,
  count = 0,
  onPress,
  children,
}: {
  label: string;
  count?: number;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.button}
      onPress={onPress}
    >
      {children}
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 8,
    gap: 4,
  },
  /** The web header's `pl-1.5` beside a back button. */
  headerBack: { paddingLeft: 6 },
  title: { flex: 1 },
  actions: { flexDirection: "row", alignItems: "center", gap: 4 },
  button: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: 4,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.danger,
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: "#ffffff", fontSize: 10, fontWeight: "600", lineHeight: 12 },
  login: {
    height: 34,
    marginRight: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  loginText: { color: colors.fg, fontSize: 14, fontWeight: "600" },
});
