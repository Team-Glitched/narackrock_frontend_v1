/**
 * Native comment list and composer (the web's CommonComments, src/features/comments/common-comments.tsx).
 *
 * `<Comments comments={model.comments} header={...} />` fills the screen below the app header: a
 * scrolling list (with pull-to-refresh) that starts with `header` (e.g. the post) followed by the
 * comment threads, and the composer pinned under it. It draws `NativeComments`
 * (src/lib/native-screens/comments.ts) and sends `NativeCommentAction`s with `useScreen().act`, so the
 * page must forward them to `useNativeComments(...).act` (src/features/comments/use-native-comments.tsx).
 * The draft lives here: it survives failed sends and clears when the page moves `composer.cleared`.
 *
 * `MenuSheet` is the bottom sheet used for the comment and post "더보기" menus.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type FC,
  type ReactElement,
} from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type FlatListInstance,
  type StyleProp,
  type TextInputInstance,
  type ViewInstance,
  type ViewStyle,
} from "react-native";
import type { SvgProps } from "react-native-svg";

import {
  COMMENT_MAX_LENGTH,
  MODERATION_REASON_MAX_LENGTH,
  clampCodePoints,
  codePointLength,
  hasVisibleText,
} from "../../src/lib/content-limits";

import HideIcon from "../../public/figma/post-hide.svg";
import ModerateIcon from "../../public/figma/admin-suspend.svg";
import ReplyIcon from "../../public/figma/comment-reply.svg";
import SendIcon from "../../public/figma/comment-send.svg";
import CloseIcon from "../../public/figma/search-close.svg";
import ReportIcon from "../../public/figma/short-report.svg";
import DislikeOffIcon from "../../public/figma/v3-comment-dislike-off.svg";
import DislikeOnIcon from "../../public/figma/v3-comment-dislike-on.svg";
import LikeOffIcon from "../../public/figma/v3-comment-like-off.svg";
import LikeOnIcon from "../../public/figma/v3-comment-like-on.svg";
import type {
  NativeComment,
  NativeCommentThread,
  NativeComments,
  NativeReplies,
} from "../../src/lib/native-screens";
import { Avatar, Button, MoreButton, TextField, Touchable } from "./kit";
import { KeyboardAvoiding } from "./keyboard-avoiding";
import { ScreenList } from "./screen";
import { useScreen } from "./screen-context";
import { ScreenModal } from "./screen-modal";
import { colors, gutter, type } from "./theme";

export type MenuItem = {
  label: string;
  icon?: FC<SvgProps>;
  onPress: () => void;
  /** Shown but not pressable, like the web's `disabled:opacity-40` menu buttons. */
  disabled?: boolean;
};

/**
 * Bottom sheet of a "더보기" menu; `label` is the web menu's accessible name. A chosen item runs
 * once the sheet has closed: on iOS only after its modal has finished dismissing, because a dialog
 * the item opens (a confirm, the report or login dialog) cannot be presented while it is going away.
 */
export function MenuSheet({
  label,
  items,
  visible,
  onClose,
}: {
  label: string;
  items: MenuItem[];
  visible: boolean;
  onClose: () => void;
}) {
  const chosen = useRef<(() => void) | null>(null);
  return (
    <ScreenModal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
      onDismiss={() => {
        const run = chosen.current;
        chosen.current = null;
        run?.();
      }}
    >
      <View style={styles.sheetRoot}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
        />
        <View style={styles.sheet} accessibilityRole="menu" accessibilityLabel={label}>
          {items.map(({ label: itemLabel, icon: Icon, onPress, disabled }) => (
            <Touchable
              key={itemLabel}
              accessibilityRole="menuitem"
              accessibilityState={{ disabled: !!disabled }}
              disabled={disabled}
              style={[styles.sheetItem, disabled && styles.sheetItemDisabled]}
              onPress={() => {
                onClose();
                if (Platform.OS === "ios") chosen.current = onPress;
                else onPress();
              }}
            >
              {Icon && <Icon width={16} height={16} />}
              <Text style={styles.sheetText}>{itemLabel}</Text>
            </Touchable>
          ))}
          <Touchable accessibilityRole="menuitem" style={styles.sheetItem} onPress={onClose}>
            <Text style={[styles.sheetText, { color: colors.muted }]}>취소</Text>
          </Touchable>
        </View>
      </View>
    </ScreenModal>
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

/**
 * Scrolls the list so the `?commentId=` comment card is centered, like the web's scrollIntoView.
 * Each highlighted id is revealed once: FlatList re-mounts rows scrolled back into view.
 */
const RevealHighlighted = createContext<(id: number, card: ViewInstance) => void>(() => {});

export function Comments({
  comments,
  header,
  focusComposer = false,
}: {
  comments: NativeComments;
  /** Content above the comments, scrolling with them (e.g. the post). */
  header?: ReactElement;
  /** Focuses the comment input once on mount (the web's `focus=1`). */
  focusComposer?: boolean;
}) {
  const { act } = useScreen();
  const [draft, setDraft] = useState("");
  useOnChange(comments.composer.cleared, () => setDraft(""));
  const list = useRef<FlatListInstance>(null);
  const revealed = useRef<number | null>(null);
  const reveal = useCallback((id: number, card: ViewInstance) => {
    if (revealed.current === id) return;
    const scroll = list.current?.getNativeScrollRef();
    const content = scroll?.getInnerViewRef();
    if (!scroll || !content) return;
    revealed.current = id;
    scroll.measure((_x, _y, _width, viewport) => {
      card.measureLayout(content, (_cardX, y, _cardWidth, height) => {
        list.current?.scrollToOffset({
          offset: Math.max(0, y - (viewport - height) / 2),
          animated: false,
        });
      });
    });
  }, []);
  return (
    <KeyboardAvoiding style={styles.flex}>
      <RevealHighlighted value={reveal}>
        <ScreenList
          listRef={list}
          style={styles.flex}
          data={comments.threads}
          keyExtractor={(thread) => String(thread.comment.id)}
          ItemSeparatorComponent={ThreadGap}
          ListHeaderComponent={
            <>
              {header}
              <ListState comments={comments} />
            </>
          }
          renderItem={({ item: thread }) => (
            <Thread thread={thread} canReply={comments.canReply} hasDraft={draft.trim() !== ""} />
          )}
          ListFooterComponent={
            comments.more ? (
              <TextButton
                label={comments.more.busy ? "불러오는 중..." : "댓글 더보기"}
                disabled={comments.more.busy}
                style={styles.padded}
                onPress={() => act({ type: "comments-more" })}
              />
            ) : undefined
          }
        />
      </RevealHighlighted>
      <Composer
        composer={comments.composer}
        draft={draft}
        onDraft={setDraft}
        focusOnMount={focusComposer}
      />
    </KeyboardAvoiding>
  );
}

function ThreadGap() {
  return <View style={styles.threadGap} />;
}

function ListState({ comments }: { comments: NativeComments }) {
  const { act } = useScreen();
  if (comments.error)
    return (
      <View style={styles.listError} accessibilityRole="alert">
        <Text style={[type.body, styles.errorText, styles.center]}>{comments.error}</Text>
        <Button
          label="다시 시도"
          tone="secondary"
          style={styles.compact}
          onPress={() => act({ type: "comments-retry" })}
        />
      </View>
    );
  if (comments.loading)
    return <Text style={[type.body, styles.padded]}>댓글을 불러오는 중...</Text>;
  if (comments.empty) return <Text style={styles.empty}>첫 댓글을 남겨보세요.</Text>;
  return null;
}

function Thread({
  thread,
  canReply,
  hasDraft,
}: {
  thread: NativeCommentThread;
  canReply: boolean;
  hasDraft: boolean;
}) {
  const { act } = useScreen();
  const { comment, replyCount, expanded, replies } = thread;
  const toggles = replyCount > 0;
  return (
    <View style={styles.padded} accessibilityLabel={`${comment.author} 댓글 대화`}>
      <CommentCard
        comment={comment}
        reply={{
          count: replyCount,
          label: toggles ? (expanded ? "답글 접기" : `답글 ${replyCount}개 보기`) : "답글 작성",
          expanded: toggles ? expanded : undefined,
          disabled: !toggles && !canReply,
          onPress: () =>
            act(
              toggles
                ? { type: "comment-toggle-replies", id: comment.id, hasDraft }
                : { type: "comment-reply", id: comment.id },
            ),
          onWriteReply:
            toggles && canReply ? () => act({ type: "comment-reply", id: comment.id }) : undefined,
        }}
      />
      {replies && <Replies parentId={comment.id} replies={replies} />}
    </View>
  );
}

function Replies({ parentId, replies }: { parentId: number; replies: NativeReplies }) {
  const { act } = useScreen();
  return (
    <View style={styles.replies}>
      <View style={styles.rail} />
      <View style={styles.flex}>
        {replies.error && (
          <View style={styles.replyError} accessibilityRole="alert">
            <Text style={[type.body, styles.errorText]}>{replies.error}</Text>
            <Button
              label="다시 시도"
              tone="secondary"
              style={styles.compact}
              onPress={() => act({ type: "comment-replies-retry", id: parentId })}
            />
          </View>
        )}
        {!replies.items && !replies.error && (
          <Text style={[type.body, styles.replyLoading]}>답글을 불러오는 중...</Text>
        )}
        {replies.items?.map((reply, index) => (
          <View key={reply.id} style={index > 0 && styles.replyGap}>
            <CommentCard comment={reply} />
          </View>
        ))}
        {replies.more && (
          <TextButton
            label={replies.more.busy ? "불러오는 중..." : `더보기 (${replies.more.remaining})`}
            disabled={replies.more.busy}
            onPress={() => act({ type: "comment-replies-more", id: parentId })}
          />
        )}
      </View>
    </View>
  );
}

function CommentCard({
  comment,
  reply,
}: {
  comment: NativeComment;
  /** The reply button of a top-level comment. */
  reply?: {
    count: number;
    label: string;
    expanded: boolean | undefined;
    disabled: boolean;
    onPress: () => void;
    onWriteReply?: () => void;
  };
}) {
  const { act, uri } = useScreen();
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const [confirm, setConfirm] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [reason, setReason] = useState("");
  const [long, setLong] = useState(false);
  const [full, setFull] = useState(false);
  const reveal = useContext(RevealHighlighted);
  const card = useRef<ViewInstance>(null);
  // Like the web's scrollIntoView effect: centers the card when it becomes the highlighted one.
  useEffect(() => {
    if (comment.highlighted && card.current) reveal(comment.id, card.current);
  }, [comment.highlighted, comment.id, reveal]);
  // A saved edit or delete closes its form, as on the web.
  useOnChange(comment.changed, () => {
    setEditing(false);
    setConfirm(false);
    setModerating(false);
  });
  const items: MenuItem[] = comment.menu.edit
    ? [
        {
          label: "수정",
          onPress: () => {
            setDraft(comment.text);
            setEditing(true);
          },
        },
        { label: "삭제", onPress: () => setConfirm(true) },
      ]
    : [
        ...(comment.menu.report
          ? [
              {
                label: "신고",
                icon: ReportIcon,
                onPress: () => act({ type: "comment-report", id: comment.id }),
              },
            ]
          : []),
        {
          label: "숨기기",
          icon: HideIcon,
          onPress: () => act({ type: "comment-hide", id: comment.id }),
        },
        ...(comment.menu.moderate
          ? [{ label: "삭제", icon: ModerateIcon, onPress: () => setModerating(true) }]
          : []),
      ];
  const LikeIcon = comment.isLiked ? LikeOnIcon : LikeOffIcon;
  const DislikeIcon = comment.isDisliked ? DislikeOnIcon : DislikeOffIcon;
  const reactDisabled = !comment.canReact || comment.reacting;
  return (
    <View ref={card} style={comment.highlighted && styles.highlighted}>
      <View style={styles.author}>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`${comment.author} 프로필`}
          hitSlop={8}
          style={styles.authorLink}
          onPress={() => act({ type: "comment-profile", userId: comment.userId })}
        >
          <Avatar uri={uri(comment.avatarUrl)} size={16} />
          <Text style={styles.authorName} numberOfLines={1}>
            {comment.author}
          </Text>
        </Touchable>
        <Text style={styles.time} numberOfLines={1}>
          • {comment.time}
        </Text>
        <MoreButton label="댓글 더보기" style={styles.more} onPress={() => setMenu(true)} />
      </View>
      <MenuSheet label="게시글 옵션" items={items} visible={menu} onClose={() => setMenu(false)} />
      {editing ? (
        <View style={styles.inlineForm}>
          <TextField
            multiline
            accessibilityLabel="댓글 내용 수정"
            value={draft}
            onChangeText={(value) => setDraft(clampCodePoints(value, COMMENT_MAX_LENGTH))}
            style={styles.editInput}
          />
          <Text style={[type.caption, { textAlign: "right" }]}>
            {codePointLength(draft)}/{COMMENT_MAX_LENGTH}자
          </Text>
          <View style={styles.inlineButtons}>
            <TextButton label="취소" small onPress={() => setEditing(false)} />
            <TextButton
              label="저장"
              small
              disabled={comment.busy || !hasVisibleText(draft)}
              onPress={() => act({ type: "comment-edit", id: comment.id, text: draft })}
            />
          </View>
        </View>
      ) : (
        <View>
          <Text style={styles.text} numberOfLines={full ? undefined : 3}>
            {comment.text}
          </Text>
          {/* Full-height copy that tells whether the text exceeds 3 lines. */}
          <Text
            style={[styles.text, styles.measure]}
            aria-hidden
            onTextLayout={(event) => setLong(event.nativeEvent.lines.length > 3)}
          >
            {comment.text}
          </Text>
          {long && (
            <Touchable
              accessibilityRole="button"
              accessibilityState={{ expanded: full }}
              style={styles.readMore}
              onPress={() => setFull(!full)}
            >
              <Text style={type.caption}>{full ? "접기" : "자세히 보기"}</Text>
            </Touchable>
          )}
        </View>
      )}
      {confirm && (
        <View style={styles.inlineForm}>
          <Text style={type.body}>이 댓글을 삭제할까요?</Text>
          <View style={styles.inlineButtons}>
            <TextButton label="취소" small onPress={() => setConfirm(false)} />
            <TextButton
              label="삭제 확인"
              small
              disabled={comment.busy}
              onPress={() => act({ type: "comment-delete", id: comment.id })}
            />
          </View>
        </View>
      )}
      {moderating && (
        <View style={styles.inlineForm}>
          <Text style={type.body}>운영자 권한으로 이 댓글을 삭제할까요?</Text>
          <TextField
            accessibilityLabel="운영 삭제 사유"
            placeholder="삭제 사유"
            value={reason}
            onChangeText={(value) =>
              setReason(clampCodePoints(value, MODERATION_REASON_MAX_LENGTH))
            }
          />
          <View style={styles.inlineButtons}>
            <TextButton label="취소" small onPress={() => setModerating(false)} />
            <TextButton
              label="삭제 확인"
              small
              disabled={comment.busy || !hasVisibleText(reason)}
              onPress={() => act({ type: "comment-moderate", id: comment.id, reason })}
            />
          </View>
        </View>
      )}
      {comment.error && (
        <Text accessibilityRole="alert" style={[styles.alert, styles.cardError]}>
          {comment.error}
        </Text>
      )}
      <View style={styles.actions}>
        {reply?.onWriteReply && (
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={`${comment.author}에게 답글 달기`}
            hitSlop={7}
            style={styles.writeReply}
            onPress={reply.onWriteReply}
          >
            <Text style={styles.writeReplyText}>답글 달기</Text>
          </Touchable>
        )}
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="댓글 좋아요"
          accessibilityState={{ selected: comment.isLiked, disabled: reactDisabled }}
          disabled={reactDisabled}
          hitSlop={7}
          style={styles.action}
          onPress={() => act({ type: "comment-vote", id: comment.id, vote: "like" })}
        >
          <LikeIcon width={14} height={14} />
          <Text style={styles.actionText}>{comment.likes}</Text>
        </Touchable>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`댓글 싫어요 ${comment.dislikes}개`}
          accessibilityState={{ selected: comment.isDisliked, disabled: reactDisabled }}
          disabled={reactDisabled}
          hitSlop={7}
          style={styles.action}
          onPress={() => act({ type: "comment-vote", id: comment.id, vote: "dislike" })}
        >
          <DislikeIcon width={14} height={14} />
          <Text style={styles.actionText}>{comment.dislikes}</Text>
        </Touchable>
        {reply && (
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={reply.label}
            accessibilityState={{ expanded: reply.expanded, disabled: reply.disabled }}
            disabled={reply.disabled}
            hitSlop={7}
            style={styles.action}
            onPress={reply.onPress}
          >
            <ReplyIcon width={14} height={14} />
            <Text style={styles.actionText}>{reply.count}</Text>
          </Touchable>
        )}
      </View>
    </View>
  );
}

function Composer({
  composer,
  draft,
  onDraft,
  focusOnMount,
}: {
  composer: NativeComments["composer"];
  draft: string;
  onDraft: (draft: string) => void;
  focusOnMount: boolean;
}) {
  const { act } = useScreen();
  const input = useRef<TextInputInstance>(null);
  useOnChange(composer.focus, () => input.current?.focus());
  const focusFirst = useRef(focusOnMount);
  useEffect(() => {
    if (focusFirst.current) input.current?.focus();
  }, []);
  const signedIn = composer.signedOut === null;
  const sendDisabled =
    composer.busy ||
    composer.hiding ||
    (signedIn && (!composer.writable || !hasVisibleText(draft)));
  return (
    <View style={styles.composer}>
      {composer.replyTo !== null && (
        <View style={styles.replying}>
          <Text style={type.caption}>{composer.replyTo}에게 답글</Text>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="답글 취소"
            style={styles.replyCancel}
            onPress={() => act({ type: "comment-cancel-reply" })}
          >
            <CloseIcon width={13} height={13} />
          </Touchable>
        </View>
      )}
      {composer.error && (
        <Text accessibilityRole="alert" style={styles.alert}>
          {composer.error}
        </Text>
      )}
      {composer.hideError && (
        <Text accessibilityRole="alert" style={styles.alert}>
          {composer.hideError}
        </Text>
      )}
      <View style={styles.inputRow}>
        {signedIn ? (
          // Enter adds a line, as on the web's touch keyboards; the button sends.
          <TextInput
            ref={input}
            multiline
            accessibilityLabel="댓글 내용"
            placeholder="입력"
            placeholderTextColor="#9692a6"
            selectionColor={colors.accent}
            value={draft}
            onChangeText={(value) => onDraft(clampCodePoints(value, COMMENT_MAX_LENGTH))}
            editable={!composer.busy && composer.writable}
            style={styles.input}
          />
        ) : (
          <Touchable
            accessibilityRole="button"
            style={styles.signIn}
            onPress={() => act({ type: "comment-login" })}
          >
            <Text style={type.muted}>{composer.signedOut}</Text>
          </Touchable>
        )}
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="댓글 보내기"
          accessibilityState={{ disabled: sendDisabled }}
          disabled={sendDisabled}
          style={styles.send}
          onPress={() => act({ type: "comment-send", text: draft })}
        >
          <SendIcon width={22} height={22} />
        </Touchable>
      </View>
      {signedIn && draft.length > 0 && (
        <Text style={[type.caption, styles.composerCount]}>
          {codePointLength(draft)}/{COMMENT_MAX_LENGTH}자
        </Text>
      )}
    </View>
  );
}

function TextButton({
  label,
  disabled = false,
  small = false,
  style,
  onPress,
}: {
  label: string;
  disabled?: boolean;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[small ? styles.smallButton : styles.textButton, disabled && styles.disabled, style]}
      onPress={onPress}
    >
      <Text style={small ? styles.smallButtonText : styles.textButtonText}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: "center" },
  padded: { paddingHorizontal: gutter },
  disabled: { opacity: 0.4 },
  threadGap: { height: 24 },
  errorText: { color: colors.error },
  alert: { color: colors.error, fontSize: 14, lineHeight: 18 },
  listError: {
    alignItems: "center",
    gap: 12,
    paddingHorizontal: gutter + 16,
    paddingVertical: 32,
  },
  compact: { minHeight: 32, paddingHorizontal: 12, borderRadius: 10 },
  empty: { ...type.muted, paddingVertical: 24, textAlign: "center" },
  replies: { flexDirection: "row", gap: 15, marginLeft: 7, marginTop: 12 },
  rail: { width: 2, borderRadius: 1, backgroundColor: colors.line },
  replyError: { gap: 8, paddingVertical: 8, alignItems: "flex-start" },
  replyLoading: { paddingVertical: 4 },
  replyGap: { marginTop: 12 },
  highlighted: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.4)",
    backgroundColor: "rgba(167, 139, 250, 0.1)",
  },
  author: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 8 },
  authorLink: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  authorName: { flexShrink: 1, color: colors.fg, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  time: { flexShrink: 0, color: colors.muted, fontSize: 10, lineHeight: 14 },
  more: { marginLeft: "auto", width: 32, height: 32 },
  text: { marginTop: 6, paddingLeft: 24, color: "#d7dce2", fontSize: 14, lineHeight: 20 },
  measure: { position: "absolute", left: 0, right: 0, opacity: 0 },
  readMore: { marginTop: 4, paddingLeft: 24, alignSelf: "flex-start" },
  inlineForm: { gap: 8, marginTop: 8, paddingLeft: 24 },
  editInput: { minHeight: 64, fontSize: 14, borderWidth: 1, borderColor: colors.muted },
  inlineButtons: { flexDirection: "row", gap: 12 },
  cardError: { marginTop: 4 },
  actions: {
    marginTop: 10,
    paddingLeft: 24,
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 14,
  },
  writeReply: { marginRight: "auto" },
  writeReplyText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "500" },
  action: { flexDirection: "row", alignItems: "center", gap: 2 },
  actionText: { color: colors.fg, fontSize: 14, lineHeight: 18, fontWeight: "500" },
  textButton: { paddingVertical: 12, alignSelf: "flex-start" },
  textButtonText: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  smallButton: { paddingVertical: 6 },
  smallButtonText: { color: colors.fg, fontSize: 14, lineHeight: 18 },
  composer: {
    marginTop: 10,
    paddingTop: 8,
    paddingHorizontal: 10,
    paddingBottom: 12,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: colors.surface,
    backgroundColor: colors.bg,
  },
  composerCount: { textAlign: "right", fontVariant: ["tabular-nums"] },
  replying: {
    minHeight: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  replyCancel: { width: 30, height: 28, alignItems: "center", justifyContent: "center" },
  inputRow: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 4 },
  // One line high, growing up to five lines (20px each) before it scrolls.
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
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top",
  },
  signIn: {
    flex: 1,
    minHeight: 36,
    justifyContent: "center",
    paddingVertical: 8,
    paddingLeft: 12,
    paddingRight: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  send: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  sheetRoot: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0, 0, 0, 0.6)" },
  sheet: {
    paddingTop: 8,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
  },
  sheetItem: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: gutter,
  },
  sheetItemDisabled: { opacity: 0.4 },
  sheetText: { color: colors.fg, fontSize: 16 },
});
