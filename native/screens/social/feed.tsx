import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListViewToken,
} from "react-native";

import ExpelIcon from "../../../public/figma/admin-expel.svg";
import SuspendIcon from "../../../public/figma/admin-suspend.svg";
import CommentIcon from "../../../public/figma/post-comment.svg";
import HideIcon from "../../../public/figma/post-hide.svg";
import ShareIcon from "../../../public/figma/post-share.svg";
import ReportIcon from "../../../public/figma/short-report.svg";
import DislikeOffIcon from "../../../public/figma/v3-post-dislike-off.svg";
import DislikeOnIcon from "../../../public/figma/v3-post-dislike-on.svg";
import LikeOffIcon from "../../../public/figma/v3-post-like-off.svg";
import LikeOnIcon from "../../../public/figma/v3-post-like-on.svg";
import SaveOffIcon from "../../../public/figma/v3-post-save-off.svg";
import SaveOnIcon from "../../../public/figma/v3-post-save-on.svg";
import type {
  NativeFeed,
  NativeFeedPost,
  NativeFeedPostMenuItem,
  NativeLookupStatus,
} from "../../../src/lib/native-screens";
import { Avatar, Button, ErrorRetry, MoreButton, TextField, Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";

/**
 * A full post card of a feed (the web's CommunityPost): author, time, menu, title, community label,
 * preview, image, reactions, save and share; inline edit form and delete confirmation like the web.
 */
export function FeedPostCard({ post }: { post: NativeFeedPost }) {
  const { act } = useScreen();
  const [menuOpen, setMenuOpen] = useState(false);
  if (post.editing) return <EditForm post={post} editing={post.editing} />;
  const open = () => act({ type: "post-open", postId: post.postId });
  return (
    <View style={styles.post}>
      <View style={styles.author}>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`${post.writer.nickname} 프로필`}
          style={styles.authorLink}
          onPress={() => act({ type: "post-profile", userId: post.writer.userId })}
        >
          <AuthorAvatar url={post.writer.profileImageUrl} />
          <Text style={styles.authorName} numberOfLines={1}>
            {post.writer.nickname || "알 수 없는 사용자"}
          </Text>
        </Touchable>
        <Text style={styles.time}>• {post.createdLabel}</Text>
        <View style={styles.flex} />
        <MoreButton label="게시글 더보기" onPress={() => !post.submitting && setMenuOpen(true)} />
      </View>
      {post.moderationNotice && (
        <Text style={styles.moderationNotice} accessibilityRole="text">
          {post.moderationNotice}
        </Text>
      )}
      <View style={styles.titleRow}>
        <Touchable
          accessibilityRole="button"
          disabled={post.submitting}
          style={styles.flex}
          onPress={open}
        >
          <Text style={styles.title}>{post.title}</Text>
        </Touchable>
        {post.community && (
          <View style={styles.community}>
            <Text
              style={styles.communityText}
              numberOfLines={1}
              accessibilityLabel={`커뮤니티 ${post.community}`}
            >
              {post.community}
            </Text>
          </View>
        )}
      </View>
      {post.preview && (
        <Touchable accessibilityRole="button" disabled={post.submitting} onPress={open}>
          <Text style={styles.preview} numberOfLines={2}>
            {post.preview}
          </Text>
        </Touchable>
      )}
      {post.error && (
        <Text style={styles.error} accessibilityRole="alert">
          {post.error}
        </Text>
      )}
      {post.confirmDelete && (
        <DeleteConfirm post={post} moderating={post.confirmDelete.moderating} />
      )}
      {post.imageUrl && <PostImage post={post} onOpen={open} />}
      <PostActionsRow post={post} />
      {post.notice && (
        <Text style={styles.error} accessibilityRole="text">
          {post.notice}
        </Text>
      )}
      <PostMenu
        post={post}
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onChoose={(item) => {
          setMenuOpen(false);
          act({ type: "post-menu", postId: post.postId, item });
        }}
      />
    </View>
  );
}

function AuthorAvatar({ url }: { url: string | null }) {
  const { uri } = useScreen();
  return <Avatar uri={uri(url)} size={20} />;
}

function PostImage({ post, onOpen }: { post: NativeFeedPost; onOpen: () => void }) {
  const { uri } = useScreen();
  const image = uri(post.imageUrl);
  if (!image) return null;
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={`${post.title} 게시글 열기`}
      onPress={onOpen}
    >
      <Image
        source={{ uri: image }}
        style={styles.image}
        resizeMode="cover"
        accessibilityLabel="게시글 첨부 이미지"
      />
    </Touchable>
  );
}

function VoteIcon({
  status,
  on,
  kind,
}: {
  status: NativeLookupStatus;
  on: boolean;
  kind: "like" | "dislike";
}) {
  if (status === "loading")
    return <ActivityIndicator size="small" color={colors.fg} style={styles.icon} />;
  if (status === "unavailable") return <Text style={styles.count}>‒</Text>;
  const Icon =
    kind === "like" ? (on ? LikeOnIcon : LikeOffIcon) : on ? DislikeOnIcon : DislikeOffIcon;
  return <Icon width={18} height={18} />;
}

/** The web's PostActions: like/dislike pill, comments, share and save. */
function PostActionsRow({ post }: { post: NativeFeedPost }) {
  const { act } = useScreen();
  const { postId, voteStatus, saveStatus, busy } = post;
  const pressedVote = (vote: "like" | "dislike") =>
    voteStatus === "ready" ? post.vote === vote : undefined;
  return (
    <View style={styles.actions}>
      <View
        style={styles.votes}
        accessibilityRole="none"
        accessibilityLabel={
          voteStatus === "loading"
            ? "반응 · 내 반응 확인 중"
            : voteStatus === "unavailable"
              ? "반응 · 내 반응을 불러오지 못했습니다"
              : "반응"
        }
      >
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`좋아요 ${post.likeCount}개`}
          accessibilityState={{ disabled: busy, selected: pressedVote("like") }}
          disabled={busy}
          style={styles.vote}
          onPress={() => act({ type: "post-vote", postId, vote: "like" })}
        >
          <VoteIcon status={voteStatus} on={post.vote === "like"} kind="like" />
          <Text style={styles.count}>{post.likeCount}</Text>
        </Touchable>
        <View style={styles.divider} />
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={
            post.dislikeCount === null ? "싫어요" : `싫어요 ${post.dislikeCount}개`
          }
          accessibilityState={{ disabled: busy, selected: pressedVote("dislike") }}
          disabled={busy}
          style={styles.vote}
          onPress={() => act({ type: "post-vote", postId, vote: "dislike" })}
        >
          <VoteIcon status={voteStatus} on={post.vote === "dislike"} kind="dislike" />
          <Text style={styles.count}>{post.dislikeCount ?? "‒"}</Text>
        </Touchable>
      </View>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`댓글 ${post.commentCount}개 보기`}
        style={styles.action}
        onPress={() => act({ type: "post-open", postId })}
      >
        <CommentIcon width={18} height={18} />
        <Text style={styles.count}>{post.commentCount}</Text>
      </Touchable>
      <View style={styles.flex} />
      <Touchable
        accessibilityRole="button"
        accessibilityLabel="공유"
        style={styles.iconButton}
        onPress={() => act({ type: "post-share", postId })}
      >
        <ShareIcon width={18} height={18} />
      </Touchable>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={
          saveStatus === "loading"
            ? "저장 상태 확인 중"
            : saveStatus === "unavailable"
              ? "저장 상태를 불러오지 못했습니다"
              : "저장"
        }
        accessibilityState={{
          disabled: busy || saveStatus !== "ready",
          busy: saveStatus === "loading",
          selected: saveStatus === "ready" ? post.saved : undefined,
        }}
        disabled={busy || saveStatus !== "ready"}
        style={styles.iconButton}
        onPress={() => act({ type: "post-save", postId })}
      >
        {saveStatus === "ready" ? (
          post.saved ? (
            <SaveOnIcon width={14} height={18} />
          ) : (
            <SaveOffIcon width={14} height={18} />
          )
        ) : saveStatus === "loading" ? (
          <ActivityIndicator size="small" color={colors.fg} />
        ) : (
          <Text style={styles.count}>‒</Text>
        )}
      </Touchable>
    </View>
  );
}

const menuItems: Record<NativeFeedPostMenuItem, { label: string; icon: ReactNode | null }> = {
  edit: { label: "수정", icon: null },
  delete: { label: "삭제", icon: null },
  report: { label: "신고", icon: <ReportIcon width={18} height={18} /> },
  hide: { label: "숨기기", icon: <HideIcon width={18} height={18} /> },
  "moderate-delete": { label: "삭제", icon: <SuspendIcon width={18} height={18} /> },
  suspend: { label: "작성자 이용정지", icon: <SuspendIcon width={18} height={18} /> },
  expel: { label: "작성자 추방", icon: <ExpelIcon width={18} height={18} /> },
};

/** "게시글 옵션" (PostUserActionsMenu) as a bottom sheet. */
function PostMenu({
  post,
  visible,
  onClose,
  onChoose,
}: {
  post: NativeFeedPost;
  visible: boolean;
  onClose: () => void;
  onChoose: (item: NativeFeedPostMenuItem) => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.sheetRoot}>
        <Pressable
          style={styles.backdrop}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
        />
        <View style={styles.sheet} accessibilityRole="menu" accessibilityLabel="게시글 옵션">
          <Text style={styles.sheetTitle} numberOfLines={1}>
            {post.title}
          </Text>
          {post.menu.map((item) => (
            <Touchable
              key={item}
              accessibilityRole="menuitem"
              style={styles.sheetItem}
              onPress={() => onChoose(item)}
            >
              {menuItems[item].icon}
              <Text style={styles.sheetText}>{menuItems[item].label}</Text>
            </Touchable>
          ))}
          <Touchable accessibilityRole="menuitem" style={styles.sheetItem} onPress={onClose}>
            <Text style={[styles.sheetText, { color: colors.muted }]}>취소</Text>
          </Touchable>
        </View>
      </View>
    </Modal>
  );
}

function EditForm({
  post,
  editing,
}: {
  post: NativeFeedPost;
  editing: { title: string; content: string };
}) {
  const { act } = useScreen();
  const [title, setTitle] = useState(editing.title);
  const [content, setContent] = useState(editing.content);
  return (
    <View style={[styles.post, styles.form]}>
      <TextField
        accessibilityLabel="게시글 제목 수정"
        placeholder="제목"
        value={title}
        editable={!post.submitting}
        onChangeText={setTitle}
      />
      <TextField
        accessibilityLabel="게시글 내용 수정"
        placeholder="내용을 입력하세요"
        multiline
        value={content}
        editable={!post.submitting}
        onChangeText={setContent}
      />
      {post.error && (
        <Text style={styles.error} accessibilityRole="alert">
          {post.error}
        </Text>
      )}
      <View style={styles.formActions}>
        <Button
          label="취소"
          tone="secondary"
          disabled={post.submitting}
          onPress={() => act({ type: "post-edit-cancel", postId: post.postId })}
        />
        <Button
          label={post.submitting ? "저장 중..." : "저장"}
          disabled={post.submitting}
          onPress={() => act({ type: "post-edit-save", postId: post.postId, title, content })}
        />
      </View>
    </View>
  );
}

function DeleteConfirm({ post, moderating }: { post: NativeFeedPost; moderating: boolean }) {
  const { act } = useScreen();
  const [reason, setReason] = useState("");
  return (
    <View style={styles.confirm} accessibilityLabel="게시글 삭제 확인">
      <Text style={type.body}>
        {moderating ? "운영자 권한으로 이 게시글을 삭제할까요?" : "이 게시글을 삭제할까요?"}
      </Text>
      {moderating && (
        <TextField
          accessibilityLabel="운영 삭제 사유"
          placeholder="삭제 사유"
          maxLength={500}
          value={reason}
          onChangeText={setReason}
        />
      )}
      <View style={styles.formActions}>
        <Button
          label="취소"
          tone="secondary"
          disabled={post.submitting}
          onPress={() => act({ type: "post-delete-cancel", postId: post.postId })}
        />
        <Button
          label={post.submitting ? "삭제 중..." : "삭제 확인"}
          disabled={post.submitting || (moderating && !reason.trim())}
          onPress={() => act({ type: "post-delete", postId: post.postId, reason })}
        />
      </View>
    </View>
  );
}

/** Status of a feed in place of its cards: loading, error with "다시 시도", or empty. */
export function FeedStatus({ feed }: { feed: NativeFeed }) {
  const { act } = useScreen();
  if (feed.status === "error")
    return <ErrorRetry message={feed.errorText} onRetry={() => act({ type: "feed-retry" })} />;
  return (
    <Text
      style={styles.status}
      accessibilityRole={feed.status === "loading" ? "progressbar" : "text"}
    >
      {feed.status === "loading" ? feed.loadingText : feed.emptyText}
    </Text>
  );
}

/** Under the cards: the web's "더보기" button (with its failure line), or "마지막 게시글이에요.". */
export function FeedFooter({ feed }: { feed: NativeFeed }) {
  const { act } = useScreen();
  if (feed.status !== "ready") return null;
  if (feed.hasMore)
    return (
      <View style={styles.feedEnd}>
        {feed.appendFailed && (
          <Text style={styles.feedError} accessibilityRole="alert">
            게시글을 더 불러오지 못했습니다.
          </Text>
        )}
        <Button
          label={feed.appending ? "불러오는 중..." : feed.appendFailed ? "다시 시도" : "더보기"}
          tone="secondary"
          disabled={feed.appending}
          onPress={() => act({ type: "more" })}
        />
      </View>
    );
  return feed.endNotice ? <Text style={styles.endNotice}>마지막 게시글이에요.</Text> : null;
}

const viewabilityConfig = { itemVisiblePercentThreshold: 1, minimumViewTime: 0 };

/**
 * Props for the FlatList of a feed: reports the cards on screen, which then load their reactions and
 * saved state like the web cards near the viewport. FlatList requires a callback that never changes.
 */
export function useFeedViewability(feed: NativeFeed) {
  const { act } = useScreen();
  const latest = useRef({ act, items: feed.items });
  useEffect(() => {
    latest.current = { act, items: feed.items };
  });
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ListViewToken[] }) => {
    const ids = viewableItems.flatMap((token) => {
      const item = token.item as { postId?: unknown } | null;
      return typeof item?.postId === "number" ? [item.postId] : [];
    });
    if (ids.length === 0) return;
    // Like the web's 300px root margin: the next cards too.
    const { items } = latest.current;
    const last = items.findIndex((post) => post.postId === ids[ids.length - 1]);
    const ahead = last < 0 ? [] : items.slice(last + 1, last + 3).map((post) => post.postId);
    latest.current.act({ type: "feed-visible", postIds: [...ids, ...ahead] });
  }).current;
  return { viewabilityConfig, onViewableItemsChanged };
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  post: {
    paddingHorizontal: gutter,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  author: { flexDirection: "row", alignItems: "center", gap: 8, height: 32 },
  authorLink: { flexDirection: "row", alignItems: "center", gap: 8, flexShrink: 1 },
  authorName: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    flexShrink: 1,
  },
  time: { color: colors.muted, fontSize: 10, lineHeight: 14 },
  moderationNotice: {
    marginVertical: 12,
    color: colors["primary-soft"],
    fontSize: 14,
    lineHeight: 20,
  },
  titleRow: {
    marginTop: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  title: { color: colors.fg, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  community: {
    maxWidth: "45%",
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surface,
  },
  communityText: { color: colors.fg, fontSize: 14, lineHeight: 18, fontWeight: "500" },
  preview: { marginBottom: 14, color: "#d7dce2", fontSize: 14, lineHeight: 20 },
  error: { color: colors.error, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  image: { width: "100%", aspectRatio: 350 / 262, borderRadius: 4, backgroundColor: colors.fg },
  actions: { marginTop: 12, height: 28, flexDirection: "row", alignItems: "center", gap: 6 },
  votes: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  vote: { flexDirection: "row", alignItems: "center", gap: 4, height: 28 },
  divider: { width: 1, height: 16, backgroundColor: "rgba(255, 255, 255, 0.25)" },
  action: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  icon: { width: 18, height: 18 },
  count: { color: colors.fg, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  form: { gap: 10 },
  formActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  confirm: { marginBottom: 16, gap: 10 },
  status: {
    paddingHorizontal: gutter,
    paddingVertical: 40,
    textAlign: "center",
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  feedEnd: {
    alignItems: "center",
    gap: 8,
    paddingTop: 12,
    paddingBottom: 24,
    paddingHorizontal: gutter,
  },
  feedError: { color: colors.error, fontSize: 14, lineHeight: 20 },
  endNotice: {
    paddingTop: 16,
    paddingBottom: 28,
    paddingHorizontal: gutter,
    textAlign: "center",
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
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
  sheetTitle: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
  },
  sheetItem: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 20,
  },
  sheetText: { color: colors.fg, fontSize: 16 },
});
