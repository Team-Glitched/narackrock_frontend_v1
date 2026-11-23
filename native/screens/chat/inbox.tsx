import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import BackIcon from "../../../public/figma/return.svg";
import type { NativeChatInbox, NativeChatInboxRow } from "../../../src/lib/native-screens";
import { HeaderButton } from "../../ui/header";
import { Avatar, Touchable } from "../../ui/kit";
import { ScreenList } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { SearchPill } from "../../ui/search-pill";
import { colors, gutter, type } from "../../ui/theme";
import { SignInRequired } from "../social/friends";
import type { ScreenProps } from "../types";
import { ChatHeaderActions, chatBarStyle } from "./parts";

/** /chat: the web's chat inbox (src/features/social/chat-screen.tsx Inbox). */
export function ChatInboxScreen({ model: inbox }: ScreenProps<"chat-inbox">) {
  const { act } = useScreen();
  return (
    <View style={styles.flex}>
      <View style={styles.bar}>
        <HeaderButton label="뒤로" onPress={() => act({ type: "back" })}>
          <BackIcon width={22} height={22} />
        </HeaderButton>
        <Text style={[type.title, styles.title]} numberOfLines={1} accessibilityRole="header">
          채팅
        </Text>
        <ChatHeaderActions />
      </View>
      {inbox.signedOut ? (
        <SignInRequired message="채팅은 로그인 후 사용할 수 있습니다." />
      ) : (
        <>
          <SearchField query={inbox.query} />
          <ScreenList
            data={inbox.rows}
            keyExtractor={(row) => String(row.userId)}
            contentContainerStyle={styles.list}
            accessibilityLabel="대화 목록"
            ListHeaderComponent={<ListState inbox={inbox} />}
            renderItem={({ item }) => (
              <Row row={item} onPress={() => act({ type: "chat-open", userId: item.userId })} />
            )}
          />
        </>
      )}
    </View>
  );
}

/** The inbox search; typing is sent to the page after a short pause, as on the web. */
function SearchField({ query }: { query: string }) {
  const { act } = useScreen();
  const [text, setText] = useState(query);
  // Follow the page's query (Back, a new URL) when it differs from what was last sent.
  const sent = useRef(query);
  useEffect(() => {
    if (query !== sent.current) {
      sent.current = query;
      setText(query);
    }
  }, [query]);
  useEffect(() => {
    if (text === sent.current) return;
    const timer = setTimeout(() => {
      sent.current = text;
      act({ type: "chat-query", value: text });
    }, 150);
    return () => clearTimeout(timer);
  }, [text, act]);
  return (
    <SearchPill
      value={text}
      onChangeText={setText}
      onClear={() => {
        setText("");
        sent.current = "";
        act({ type: "chat-query", value: "" });
      }}
      clearLabel="검색어 지우기"
      placeholder="대화 상대 검색"
      returnKeyType="search"
      accessibilityLabel="대화 상대 검색"
      style={styles.search}
    />
  );
}

function ListState({ inbox }: { inbox: NativeChatInbox }) {
  const { act } = useScreen();
  return (
    <>
      {inbox.error && (
        <View style={styles.box} accessibilityRole="alert">
          <Text style={type.muted}>{inbox.error}</Text>
          <Touchable
            accessibilityRole="button"
            style={styles.retry}
            onPress={() => act({ type: "chat-retry" })}
          >
            <Text style={styles.retryText}>다시 시도</Text>
          </Touchable>
        </View>
      )}
      {inbox.loading && (
        <View
          style={[styles.box, styles.skeleton]}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="대화 목록을 불러오는 중..."
        >
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonLines}>
            <View style={[styles.skeletonLine, { width: 80 }]} />
            <View style={[styles.skeletonLine, { width: 144, maxWidth: "100%" }]} />
          </View>
        </View>
      )}
      {inbox.reconnecting && (
        <Text style={[type.caption, styles.reconnecting]}>
          실시간 연결이 끊겨 대화 목록을 다시 확인하는 중입니다.
        </Text>
      )}
      {inbox.empty && (
        <View style={styles.box}>
          <Text style={type.muted}>{inbox.empty}</Text>
        </View>
      )}
    </>
  );
}

function Row({ row, onPress }: { row: NativeChatInboxRow; onPress: () => void }) {
  const { uri } = useScreen();
  const unread = row.unreadCount > 0;
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={[
        row.nickname,
        row.preview,
        row.time,
        unread ? `읽지 않은 메시지 ${row.unreadCount}개` : null,
      ]
        .filter(Boolean)
        .join(", ")}
      style={styles.row}
      onPress={onPress}
    >
      <Avatar uri={uri(row.profileImageUrl)} size={56} />
      <View style={styles.flex}>
        <Text style={[type.label, { fontWeight: unread ? "700" : "500" }]} numberOfLines={1}>
          {row.nickname}
        </Text>
        <View style={styles.previewLine}>
          <Text
            style={[unread ? [type.body, { fontWeight: "600" }] : type.muted, styles.preview]}
            numberOfLines={1}
          >
            {row.preview}
          </Text>
          {row.time !== null && (
            <>
              <Text style={type.caption}>·</Text>
              <Text style={type.caption}>{row.time}</Text>
            </>
          )}
        </View>
      </View>
      <View style={styles.dotColumn}>{unread && <View style={styles.dot} />}</View>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bar: chatBarStyle,
  title: { flex: 1, paddingLeft: 4 },
  search: { marginHorizontal: gutter, marginTop: 8, marginBottom: 12 },
  list: { paddingHorizontal: 8 },
  box: {
    minHeight: 76,
    marginHorizontal: 12,
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: colors.surface,
  },
  retry: { marginTop: 8, minHeight: 36, justifyContent: "center", alignSelf: "flex-start" },
  retryText: { color: colors.fg, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  skeleton: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 0 },
  skeletonAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.line },
  skeletonLines: { flex: 1, gap: 8 },
  skeletonLine: { height: 12, borderRadius: 6, backgroundColor: colors.line },
  reconnecting: { paddingHorizontal: 12, paddingVertical: 8 },
  row: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  previewLine: { marginTop: 4, flexDirection: "row", alignItems: "baseline", gap: 6 },
  preview: { flexShrink: 1 },
  dotColumn: { width: 10, alignItems: "center" },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#8b5cf6" },
});
