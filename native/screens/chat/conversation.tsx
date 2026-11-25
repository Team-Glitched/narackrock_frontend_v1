import { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type FlatListInstance,
} from "react-native";

import SendIcon from "../../../public/figma/comment-send.svg";
import BackIcon from "../../../public/figma/return.svg";
import type {
  NativeChatConversation,
  NativeChatMessage,
  NativeChatThread,
} from "../../../src/lib/native-screens";
import { MenuSheet } from "../../ui/comments";
import { HeaderButton } from "../../ui/header";
import { Avatar, Button, Touchable } from "../../ui/kit";
import { KeyboardAvoiding } from "../../ui/keyboard-avoiding";
import { useScreen } from "../../ui/screen-context";
import { ScreenModal } from "../../ui/screen-modal";
import { colors, gutter, type } from "../../ui/theme";
import {
  clampCodePoints,
  codePointLength,
  hasVisibleText,
  sanitizeMultiline,
} from "../../../src/lib/content-limits";
import { SignInRequired } from "../social/friends";
import type { ScreenProps } from "../types";
import { ChatHeaderActions, chatBarStyle } from "./parts";

/** /chat?userId=: the web's conversation (src/features/social/chat-screen.tsx Conversation). */
export function ChatConversationScreen({ model }: ScreenProps<"chat-conversation">) {
  const { act } = useScreen();
  const [menuTarget, setMenuTarget] = useState<NativeChatMessage | null>(null);
  const [editing, setEditing] = useState<{ id: number; original: string } | null>(null);
  const confirmDelete = model.thread?.confirmDelete ?? null;
  // Deleting the message being edited ends the edit, as on the web.
  const editingDeleted =
    editing !== null &&
    (model.thread?.messages.some((message) => message.id === editing.id && message.deleted) ??
      false);
  useEffect(() => {
    if (editingDeleted) setEditing(null);
  }, [editingDeleted]);
  const openMenu = (message: NativeChatMessage) => {
    act({ type: "chat-clear-notice" });
    setMenuTarget(message);
  };
  const cancelDelete = () => {
    if (!confirmDelete?.busy) act({ type: "chat-delete-cancel" });
  };

  return (
    <KeyboardAvoiding style={styles.flex}>
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
          <Messages
            thread={model.thread}
            partnerImage={model.partner?.profileImageUrl ?? null}
            onOpenMenu={openMenu}
          />
          <Composer
            composer={model.thread.composer}
            editing={editing}
            onCancelEdit={() => setEditing(null)}
          />
          <MenuSheet
            label="메시지 옵션"
            visible={menuTarget !== null}
            onClose={() => setMenuTarget(null)}
            items={
              menuTarget
                ? [
                    {
                      label: "수정",
                      onPress: () =>
                        setEditing({ id: menuTarget.id, original: menuTarget.content }),
                    },
                    {
                      label: "삭제",
                      onPress: () => act({ type: "chat-delete-ask", messageId: menuTarget.id }),
                    },
                  ]
                : []
            }
          />
          <ScreenModal
            visible={confirmDelete !== null}
            transparent
            animationType="fade"
            statusBarTranslucent
            onRequestClose={cancelDelete}
          >
            <View style={styles.modalBackdrop}>
              <Pressable
                style={StyleSheet.absoluteFill}
                accessibilityRole="button"
                accessibilityLabel="닫기"
                onPress={cancelDelete}
              />
              <View style={styles.confirmCard} accessibilityViewIsModal>
                <Text style={styles.confirmTitle} accessibilityRole="header">
                  메시지를 삭제할까요?
                </Text>
                <Text style={type.muted}>
                  삭제한 메시지는 대화에서 &ldquo;삭제된 메시지입니다.&rdquo;로 표시됩니다.
                </Text>
                {confirmDelete?.error && (
                  <Text accessibilityRole="alert" style={styles.confirmError}>
                    {confirmDelete.error}
                  </Text>
                )}
                <View style={styles.confirmActions}>
                  <Button
                    label="취소"
                    tone="secondary"
                    disabled={confirmDelete?.busy}
                    style={styles.compact}
                    onPress={cancelDelete}
                  />
                  <Button
                    label={confirmDelete?.busy ? "삭제 중..." : "삭제"}
                    disabled={confirmDelete?.busy}
                    style={styles.compact}
                    onPress={() => act({ type: "chat-delete" })}
                  />
                </View>
              </View>
            </View>
          </ScreenModal>
        </>
      ) : null}
    </KeyboardAvoiding>
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
      <ChatHeaderActions />
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
  onOpenMenu,
}: {
  thread: NativeChatThread;
  partnerImage: string | null;
  onOpenMenu: (message: NativeChatMessage) => void;
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
          <Bubble
            message={item.message}
            avatar={avatar}
            showAvatar={item.showAvatar}
            onOpenMenu={onOpenMenu}
          />
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
  onOpenMenu,
}: {
  message: NativeChatMessage;
  avatar: string | null;
  showAvatar: boolean;
  onOpenMenu: (message: NativeChatMessage) => void;
}) {
  const deleted = Boolean(message.deleted);
  if (message.outgoing) {
    if (deleted) {
      return (
        <View style={[styles.bubble, styles.outgoing, styles.deletedBubble]}>
          <Text style={[type.body, styles.outgoingText, styles.deletedText]}>
            삭제된 메시지입니다.
          </Text>
        </View>
      );
    }
    return (
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`${message.content}, 길게 눌러 수정 또는 삭제`}
        // The web's "메시지 옵션" button, for screen readers.
        accessibilityActions={[{ name: "message-options", label: "메시지 옵션" }]}
        onAccessibilityAction={(event) => {
          if (event.nativeEvent.actionName === "message-options") onOpenMenu(message);
        }}
        delayLongPress={450}
        onLongPress={() => onOpenMenu(message)}
        style={[styles.bubble, styles.outgoing]}
      >
        {/* Omit `selectable` here so OS text selection does not hijack long-press actions. */}
        <Text style={[type.body, styles.outgoingText]}>{message.content}</Text>
        {message.editedAt ? <Text style={styles.editedOutgoing}>(수정됨)</Text> : null}
      </Touchable>
    );
  }
  return (
    <View style={styles.incoming}>
      {showAvatar ? <Avatar uri={avatar} size={32} /> : <View style={styles.avatarGap} />}
      <View style={[styles.bubble, styles.incomingBubble, deleted && styles.deletedBubble]}>
        <Text selectable={!deleted} style={[type.body, styles.incomingText, deleted && styles.deletedText]}>
          {deleted ? "삭제된 메시지입니다." : message.content}
        </Text>
        {!deleted && message.editedAt ? <Text style={styles.editedIncoming}>(수정됨)</Text> : null}
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
function Composer({
  composer,
  editing,
  onCancelEdit,
}: {
  composer: NativeChatThread["composer"];
  editing: { id: number; original: string } | null;
  onCancelEdit: () => void;
}) {
  const { act } = useScreen();
  const [draft, setDraft] = useState("");
  const [syncedEditId, setSyncedEditId] = useState<number | null>(null);
  if ((editing?.id ?? null) !== syncedEditId) {
    setSyncedEditId(editing?.id ?? null);
    setDraft(editing ? editing.original : "");
  }
  useOnChange(composer.sent, () => {
    setDraft("");
    onCancelEdit();
  });
  const content = sanitizeMultiline(draft);
  const sendDisabled =
    !hasVisibleText(content) ||
    codePointLength(content) > composer.maxLength ||
    composer.busy ||
    !composer.enabled;
  return (
    <View style={styles.composer}>
      {editing && (
        <View style={styles.editBanner}>
          <Text style={styles.editBannerText}>메시지 수정 중</Text>
          <Touchable
            accessibilityRole="button"
            onPress={() => {
              setDraft("");
              onCancelEdit();
              act({ type: "chat-clear-notice" });
            }}
          >
            <Text style={styles.editCancelText}>취소</Text>
          </Touchable>
        </View>
      )}
      {composer.notice !== null && (
        <Text accessibilityRole="alert" style={styles.notice}>
          {composer.notice}
        </Text>
      )}
      <View style={styles.inputRow}>
        {/* Enter adds a line, as in the web's textarea; the button sends. */}
        <TextInput
          multiline
          accessibilityLabel={editing ? "메시지 수정 내용" : "메시지"}
          placeholder="입력"
          placeholderTextColor="#9692a6"
          selectionColor={colors.accent}
          value={draft}
          onChangeText={(value) => setDraft(clampCodePoints(value, composer.maxLength))}
          editable={composer.enabled}
          style={[styles.input, !composer.enabled && styles.inputDisabled]}
        />
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={editing ? "수정 완료" : "메시지 보내기"}
          accessibilityState={{ disabled: sendDisabled, busy: composer.busy }}
          disabled={sendDisabled}
          style={styles.send}
          onPress={() =>
            act(
              editing
                ? { type: "chat-edit", messageId: editing.id, text: content }
                : { type: "chat-send", text: content },
            )
          }
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
  bar: chatBarStyle,
  recipient: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
  recipientText: { flex: 1, minWidth: 0, gap: 2 },
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
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
    backgroundColor: colors.bg,
  },
  notice: { marginBottom: 6, color: colors.error, fontSize: 12, lineHeight: 16 },
  inputRow: { minHeight: 40, flexDirection: "row", alignItems: "flex-end", gap: 10 },
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
  deletedBubble: { opacity: 0.7 },
  deletedText: { fontStyle: "italic" },
  editedOutgoing: { marginTop: 4, textAlign: "right", color: "rgba(255,255,255,0.75)", fontSize: 11 },
  editedIncoming: { marginTop: 4, textAlign: "right", color: "rgba(18,19,21,0.65)", fontSize: 11 },
  editBanner: {
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editBannerText: { color: colors.fg, fontSize: 12, fontWeight: "600" },
  editCancelText: { color: colors.muted, fontSize: 12, textDecorationLine: "underline" },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  confirmCard: {
    width: 320,
    maxWidth: "100%",
    borderRadius: 20,
    padding: 20,
    gap: 12,
    backgroundColor: colors.bg,
  },
  confirmTitle: { color: colors.fg, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  confirmError: { color: colors.error, fontSize: 12, lineHeight: 16 },
  confirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
});
