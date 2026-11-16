import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  type FlatListInstance,
} from "react-native";

import SendIcon from "../../../public/figma/comment-send.svg";
import BackIcon from "../../../public/figma/return.svg";
import SearchIcon from "../../../public/figma/search.svg";
import type {
  NativeChatConversation,
  NativeChatMessage,
  NativeChatThread,
} from "../../../src/lib/native-screens";
import { HeaderButton } from "../../ui/header";
import { Avatar, Button, Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";
import { SignInRequired } from "../social/friends";
import type { ScreenProps } from "../types";
import { ChatBell } from "./parts";

/** /chat?userId=: the web's conversation (src/features/social/chat-screen.tsx Conversation). */
export function ChatConversationScreen({ model }: ScreenProps<"chat-conversation">) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <TopBar model={model} />
      {model.signedOut ? (
        <SignInRequired message="채팅은 로그인 후 사용할 수 있습니다." />
      ) : model.opening ? (
        <Text style={[type.body, styles.padded]}>대화를 여는 중...</Text>
      ) : model.openError !== null ? (
        <Text accessibilityRole="alert" style={[type.body, styles.padded]}>
          {model.openError}
        </Text>
      ) : model.thread ? (
        <>
          <Messages thread={model.thread} partnerImage={model.partner?.profileImageUrl ?? null} />
          <Composer composer={model.thread.composer} />
        </>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function TopBar({ model }: { model: NativeChatConversation }) {
  const { act, uri } = useScreen();
  const partner = model.partner;
  return (
    <View style={styles.bar}>
      <HeaderButton label="뒤로" onPress={() => act({ type: "back" })}>
        <BackIcon width={22} height={22} />
      </HeaderButton>
      {partner ? (
        <Touchable
          accessibilityRole="button"
          style={styles.recipient}
          onPress={() => act({ type: "chat-partner" })}
        >
          <Avatar uri={uri(partner.profileImageUrl)} size={32} />
          <View style={styles.recipientText}>
            <Text style={[type.label, styles.bold]} numberOfLines={1}>
              {partner.nickname}
            </Text>
            <Text style={type.muted} numberOfLines={1}>
              {partner.instrument}
            </Text>
          </View>
        </Touchable>
      ) : (
        <Text style={[type.label, styles.bold, styles.flex]} accessibilityRole="header">
          채팅
        </Text>
      )}
      <ChatBell />
      <HeaderButton label="검색" onPress={() => act({ type: "search" })}>
        <SearchIcon width={24} height={24} />
      </HeaderButton>
    </View>
  );
}

type MessageRow = {
  message: NativeChatMessage;
  date: string | null;
  grouped: boolean;
  showAvatar: boolean;
};

function messageRows(messages: NativeChatMessage[]): MessageRow[] {
  const dates = messages.map((message) => new Date(message.createdAt));
  const sameGroup = (left: number, right: number) =>
    left >= 0 &&
    right < messages.length &&
    messages[left].outgoing === messages[right].outgoing &&
    dates[left].toDateString() === dates[right].toDateString() &&
    Math.abs(dates[right].getTime() - dates[left].getTime()) < 5 * 60_000;
  return messages
    .map((message, index) => ({
      message,
      date:
        index === 0 || dates[index - 1].toDateString() !== dates[index].toDateString()
          ? dates[index].toLocaleDateString("ko-KR", {
              year: "numeric",
              month: "long",
              day: "numeric",
              weekday: "short",
            })
          : null,
      grouped: sameGroup(index - 1, index),
      showAvatar: !sameGroup(index, index + 1),
    }))
    .reverse();
}

/** Newest at the bottom (inverted list); jumps to the newest message when one arrives, as the web does. */
function Messages({
  thread,
  partnerImage,
}: {
  thread: NativeChatThread;
  partnerImage: string | null;
}) {
  const { uri } = useScreen();
  const list = useRef<FlatListInstance>(null);
  const newestFirst = useMemo(() => messageRows(thread.messages), [thread.messages]);
  const lastId = newestFirst[0]?.message.id;
  useEffect(() => {
    if (lastId !== undefined) list.current?.scrollToOffset({ offset: 0, animated: true });
  }, [lastId]);
  const avatar = uri(partnerImage);
  return (
    <FlatList
      ref={list}
      inverted
      style={styles.flex}
      data={newestFirst}
      keyExtractor={({ message }) => String(message.id)}
      contentContainerStyle={styles.messages}
      maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      accessibilityLabel="대화 내용"
      // The top of the conversation (the list is inverted): status lines and older messages.
      ListFooterComponent={<ThreadHead thread={thread} />}
      renderItem={({ item }) => (
        <View style={item.grouped ? styles.groupedRow : styles.messageRow}>
          {item.date !== null && <Text style={styles.date}>{item.date}</Text>}
          <Bubble message={item.message} avatar={avatar} showAvatar={item.showAvatar} />
        </View>
      )}
    />
  );
}

function ThreadHead({ thread }: { thread: NativeChatThread }) {
  const { act } = useScreen();
  return (
    <View style={styles.head}>
      {thread.reconnecting && (
        <Text style={type.body} accessibilityLiveRegion="polite">
          실시간 연결이 끊겨 3초마다 새 메시지를 확인합니다.
        </Text>
      )}
      {thread.error !== null && (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={[type.body, styles.errorText]}>{thread.error}</Text>
          <Button
            label="다시 시도"
            tone="secondary"
            style={styles.compact}
            onPress={() => act({ type: "chat-retry" })}
          />
        </View>
      )}
      {thread.older && (
        <Touchable
          accessibilityRole="button"
          style={styles.older}
          onPress={() => act({ type: "chat-older" })}
        >
          <Text style={styles.olderText}>이전 메시지 더보기</Text>
        </Touchable>
      )}
      {thread.loading && <Text style={type.body}>대화를 불러오는 중...</Text>}
    </View>
  );
}

function Bubble({
  message,
  avatar,
  showAvatar,
}: {
  message: NativeChatMessage;
  avatar: string | null;
  showAvatar: boolean;
}) {
  if (message.outgoing)
    return (
      <View style={[styles.bubble, styles.outgoing]}>
        <Text selectable style={[type.body, styles.outgoingText]}>
          {message.content}
        </Text>
      </View>
    );
  return (
    <View style={styles.incoming}>
      {showAvatar ? <Avatar uri={avatar} size={32} /> : <View style={styles.avatarGap} />}
      <View style={[styles.bubble, styles.incomingBubble]}>
        <Text selectable style={[type.body, styles.incomingText]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

/** Counter from the page that should trigger `run` when it moves (not on mount). */
function useOnChange(value: number, run: () => void) {
  const last = useRef(value);
  useEffect(() => {
    if (last.current === value) return;
    last.current = value;
    run();
  });
}

/** Draft in native state; the button sends it, the page clears it through `sent` once delivered. */
function Composer({ composer }: { composer: NativeChatThread["composer"] }) {
  const { act } = useScreen();
  const [draft, setDraft] = useState("");
  useOnChange(composer.sent, () => setDraft(""));
  const content = draft.trim();
  const sendDisabled =
    content.length === 0 ||
    content.length > composer.maxLength ||
    composer.busy ||
    !composer.enabled;
  return (
    <View style={styles.composer}>
      {composer.notice !== null && (
        <Text accessibilityRole="alert" style={styles.notice}>
          {composer.notice}
        </Text>
      )}
      <View style={styles.inputRow}>
        <View style={styles.attachment} importantForAccessibility="no-hide-descendants">
          <View style={styles.attachmentBar} />
          <View style={[styles.attachmentBar, styles.attachmentBarCross]} />
        </View>
        {/* Enter adds a line, as in the web's textarea; the button sends. */}
        <TextInput
          multiline
          accessibilityLabel="메시지"
          placeholder="입력"
          placeholderTextColor="#9692a6"
          selectionColor={colors.accent}
          value={draft}
          onChangeText={setDraft}
          maxLength={composer.maxLength}
          editable={composer.enabled}
          style={[styles.input, !composer.enabled && styles.inputDisabled]}
        />
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="메시지 보내기"
          accessibilityState={{ disabled: sendDisabled, busy: composer.busy }}
          disabled={sendDisabled}
          style={styles.send}
          onPress={() => act({ type: "chat-send", text: draft })}
        >
          <SendIcon width={22} height={22} />
        </Touchable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontWeight: "700" },
  padded: { paddingHorizontal: gutter, paddingVertical: 8 },
  bar: { height: 44, flexDirection: "row", alignItems: "center", paddingHorizontal: 4 },
  recipient: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  recipientText: { flex: 1, gap: 4 },
  // Inverted: flex-end keeps a short conversation at the top, as on the web.
  messages: { flexGrow: 1, justifyContent: "flex-end", paddingVertical: 30, paddingHorizontal: 20 },
  messageRow: { paddingTop: 20 },
  groupedRow: { paddingTop: 4 },
  date: { ...type.caption, textAlign: "center", paddingBottom: 20, color: colors.muted },
  avatarGap: { width: 32 },
  head: { gap: 20, paddingBottom: 20 },
  error: { alignItems: "center", gap: 12, paddingVertical: 24 },
  errorText: { color: colors.error, textAlign: "center" },
  compact: { minHeight: 32, paddingHorizontal: 12, borderRadius: 10 },
  older: { paddingVertical: 12, alignSelf: "flex-start" },
  olderText: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  bubble: { maxWidth: 272, paddingVertical: 12, paddingHorizontal: 10 },
  outgoing: {
    alignSelf: "flex-end",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 4,
    borderBottomLeftRadius: 20,
    backgroundColor: colors.primary,
  },
  outgoingText: { color: colors.fg },
  incoming: { flexDirection: "row", alignItems: "flex-end", gap: 10, alignSelf: "flex-start" },
  incomingBubble: {
    flexShrink: 1,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomLeftRadius: 4,
    backgroundColor: "#d7dce2",
  },
  incomingText: { color: colors.bg },
  composer: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
    backgroundColor: colors.bg,
  },
  notice: { marginBottom: 6, color: colors.error, fontSize: 12, lineHeight: 16 },
  inputRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4 },
  attachment: { width: 18, height: 18, marginHorizontal: 4 },
  attachmentBar: {
    position: "absolute",
    top: 8,
    left: 0,
    width: 18,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.fg,
  },
  attachmentBarCross: { transform: [{ rotate: "90deg" }] },
  // One line high, growing to five lines before it scrolls.
  input: {
    flex: 1,
    minHeight: 36,
    maxHeight: 116,
    paddingTop: 8,
    paddingBottom: 8,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
    color: colors.fg,
    fontSize: 16,
    lineHeight: 20,
    textAlignVertical: "top",
  },
  inputDisabled: { opacity: 0.5 },
  send: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
});
