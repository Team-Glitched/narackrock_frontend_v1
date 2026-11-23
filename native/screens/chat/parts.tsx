import { StyleSheet, Text, View } from "react-native";

import BellIcon from "../../../public/figma/v3-bell.svg";
import SearchIcon from "../../../public/figma/v3-search.svg";
import { HeaderButton } from "../../ui/header";
import { Avatar, Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";

/** Top bar metrics matching native/ui/header.tsx (Header / AppHeader with back button). */
export const chatBarStyle = {
  height: 48,
  flexDirection: "row",
  alignItems: "center",
  paddingLeft: 6,
  paddingRight: 8,
  gap: 4,
} as const;

/** The web's NotificationBell in the chat top bars: unread badge, opens the notifications. */
export function ChatBell() {
  const { act, session } = useScreen();
  const count = session.userId === null ? 0 : session.unreadNotifications;
  return (
    <HeaderButton
      label={count ? `알림, 미확인 ${count}개` : "알림"}
      count={count}
      onPress={() => act({ type: "notifications" })}
    >
      <BellIcon width={22} height={26} />
    </HeaderButton>
  );
}

/** Right-side chat header controls matching <Header showChat={false} />: Notifications, Search, Profile/Login. */
export function ChatHeaderActions() {
  const { act, session, uri } = useScreen();
  const signedIn = session.userId !== null;
  return (
    <View style={styles.actions}>
      <ChatBell />
      <HeaderButton label="검색" onPress={() => act({ type: "search" })}>
        <SearchIcon width={24} height={24} />
      </HeaderButton>
      {!signedIn ? (
        <Touchable
          accessibilityRole="button"
          style={styles.login}
          onPress={() => act({ type: "login" })}
        >
          <Text style={styles.loginText}>로그인</Text>
        </Touchable>
      ) : (
        <HeaderButton label="프로필" onPress={() => act({ type: "profile" })}>
          <Avatar uri={uri(session.profileImageUrl)} size={32} />
        </HeaderButton>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", alignItems: "center", gap: 4 },
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
