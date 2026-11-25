import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import ExpelIcon from "../../../public/figma/admin-expel.svg";
import ModerateIcon from "../../../public/figma/admin-suspend.svg";
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
import type { NativePostDetail } from "../../../src/lib/native-screens";
import {
  MODERATION_REASON_MAX_LENGTH,
  clampCodePoints,
  hasVisibleText,
  sanitizeSingleLine,
} from "../../../src/lib/content-limits";
import { Comments, MenuSheet, type MenuItem } from "../../ui/comments";
import { AppHeader } from "../../ui/header";
import { Avatar, Button, MoreButton, Status, TextField, Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";
import type { ScreenProps } from "../types";

/** The web post page (src/features/posts/post-comments.tsx PostCommentsScreen): the post and its comments. */
export function PostDetailScreen({ model, header }: ScreenProps<"post-detail">) {
  return (
    <>
      {header && <AppHeader header={header} />}
      {model.invalid ? (
        <Status tone="error">올바르지 않은 페이지 주소입니다.</Status>
      ) : (
        <Comments comments={model.comments} header={<PostHeader model={model} />} />
      )}
    </>
  );
}

function PostHeader({ model }: { model: NativePostDetail }) {
  const { act } = useScreen();
  const { post } = model;
  return (
    <View>
      {model.error && (
        <View style={styles.error} accessibilityRole="alert">
          <Text style={[type.body, { color: colors.error }]}>{model.error}</Text>
          {model.retry && (
            <Button
              label="다시 시도"
              tone="secondary"
              style={styles.compact}
              onPress={() => act({ type: "post-retry" })}
            />
          )}
        </View>
      )}
      {!post && !model.error && (
        <Text style={[type.body, styles.padded]}>게시글을 불러오는 중...</Text>
      )}
      {model.notice && (
        <Text accessibilityLiveRegion="polite" style={[type.caption, styles.padded]}>
          {model.notice}
        </Text>
      )}
      {post && (
        <>
          <PostArticle model={model} post={post} />
          <View style={styles.divider} />
        </>
      )}
    </View>
  );
}

function PostArticle({
  model,
  post,
}: {
  model: NativePostDetail;
  post: NonNullable<NativePostDetail["post"]>;
}) {
  const { act, uri } = useScreen();
  const [menu, setMenu] = useState(false);
  const [reason, setReason] = useState("");
  const image = uri(post.imageUrl);
  const items: MenuItem[] = [
    { label: "신고", icon: ReportIcon, onPress: () => act({ type: "post-report" }) },
    { label: "숨기기", icon: HideIcon, onPress: () => act({ type: "post-hide" }) },
    ...(model.menu.moderate
      ? [{ label: "삭제", icon: ModerateIcon, onPress: () => act({ type: "post-delete-open" }) }]
      : []),
    ...(model.menu.sanction
      ? [
          {
            label: "작성자 이용정지",
            icon: ModerateIcon,
            onPress: () => act({ type: "post-sanction", action: "suspend" }),
          },
          {
            label: "작성자 추방",
            icon: ExpelIcon,
            onPress: () => act({ type: "post-sanction", action: "expel" }),
          },
        ]
      : []),
  ];
  const LikeIcon = post.vote === "like" ? LikeOnIcon : LikeOffIcon;
  const DislikeIcon = post.vote === "dislike" ? DislikeOnIcon : DislikeOffIcon;
  const SaveIcon = post.saved ? SaveOnIcon : SaveOffIcon;
  return (
    <View style={styles.article}>
      <View style={styles.author}>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`${post.writer.nickname} 프로필`}
          style={styles.authorLink}
          onPress={() => act({ type: "open-profile", userId: post.writer.userId })}
        >
          <Avatar uri={uri(post.writer.profileImageUrl)} size={16} />
          <Text style={styles.authorName} numberOfLines={1}>
            {post.writer.nickname}
          </Text>
        </Touchable>
        <Text style={styles.time} numberOfLines={1}>
          • {post.createdLabel}
        </Text>
        <MoreButton label="게시글 더보기" style={styles.more} onPress={() => setMenu(true)} />
      </View>
      <MenuSheet label="게시글 옵션" items={items} visible={menu} onClose={() => setMenu(false)} />
      {model.confirmDelete && (
        <View style={styles.confirm} accessibilityLabel="게시글 삭제 확인">
          <Text style={styles.content}>운영자 권한으로 이 게시글을 삭제할까요?</Text>
          <TextField
            accessibilityLabel="운영 삭제 사유"
            placeholder="삭제 사유"
            value={reason}
            onChangeText={(value) =>
              setReason(clampCodePoints(value, MODERATION_REASON_MAX_LENGTH))
            }
          />
          <View style={styles.confirmButtons}>
            <Button
              label="취소"
              tone="secondary"
              disabled={model.deleting}
              style={styles.flex}
              onPress={() => act({ type: "post-delete-cancel" })}
            />
            <Button
              label={model.deleting ? "삭제 중..." : "삭제 확인"}
              disabled={model.deleting || !hasVisibleText(reason)}
              style={styles.flex}
              onPress={() => act({ type: "post-delete", reason: sanitizeSingleLine(reason) })}
            />
          </View>
        </View>
      )}
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          {post.title}
        </Text>
      </View>
      {post.content !== "" && <Text style={styles.content}>{post.content}</Text>}
      {image && (
        <Image
          source={{ uri: image }}
          style={styles.image}
          accessibilityLabel="게시글 첨부 이미지"
          resizeMode="cover"
        />
      )}
      <View style={styles.actions}>
        <View style={styles.votes} accessibilityRole="none" accessibilityLabel="반응">
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={`좋아요 ${post.likeCount}개`}
            accessibilityState={{ selected: post.vote === "like", disabled: model.busy }}
            disabled={model.busy}
            hitSlop={6}
            style={styles.vote}
            onPress={() => act({ type: "post-vote", vote: "like" })}
          >
            <LikeIcon width={17} height={17} />
            <Text style={styles.count}>{post.likeCount}</Text>
          </Touchable>
          <View style={styles.voteDivider} />
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={`싫어요 ${post.dislikeCount}개`}
            accessibilityState={{ selected: post.vote === "dislike", disabled: model.busy }}
            disabled={model.busy}
            hitSlop={6}
            style={styles.vote}
            onPress={() => act({ type: "post-vote", vote: "dislike" })}
          >
            <DislikeIcon width={17} height={17} />
            <Text style={styles.count}>{post.dislikeCount}</Text>
          </Touchable>
        </View>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`댓글 ${post.commentCount}개 보기`}
          style={styles.pill}
          onPress={() => act({ type: "post-comments" })}
        >
          <CommentIcon width={17} height={17} />
          <Text style={styles.count}>{post.commentCount}</Text>
        </Touchable>
        <View style={styles.flex} />
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="공유"
          style={styles.iconButton}
          onPress={() => act({ type: "post-share" })}
        >
          <ShareIcon width={17} height={17} />
        </Touchable>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="저장"
          accessibilityState={{ selected: post.saved, disabled: model.busy }}
          disabled={model.busy}
          style={styles.iconButton}
          onPress={() => act({ type: "post-save" })}
        >
          <SaveIcon width={12} height={16} />
        </Touchable>
      </View>
      {model.interactionNotice && (
        <Text style={[styles.content, styles.notice]}>{model.interactionNotice}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  padded: { paddingHorizontal: gutter, paddingVertical: 8 },
  compact: { minHeight: 32, paddingHorizontal: 12, borderRadius: 10, alignSelf: "flex-start" },
  error: { gap: 8, paddingHorizontal: gutter, paddingVertical: 8 },
  article: { paddingTop: 20, paddingHorizontal: gutter, paddingBottom: 16 },
  author: { height: 32, flexDirection: "row", alignItems: "center", gap: 8 },
  authorLink: { flexShrink: 1, height: 32, flexDirection: "row", alignItems: "center", gap: 6 },
  authorName: { flexShrink: 1, color: colors.fg, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  time: { flexShrink: 0, color: colors.muted, fontSize: 10, lineHeight: 14 },
  more: { marginLeft: "auto", width: 32, height: 32 },
  titleRow: {
    marginTop: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  title: { flex: 1, color: colors.fg, fontSize: 16, lineHeight: 22, fontWeight: "700" },
  content: { marginBottom: 14, color: "#d7dce2", fontSize: 14, lineHeight: 20 },
  notice: { marginTop: 8, marginBottom: 0 },
  divider: {
    height: 1,
    marginVertical: 20,
    marginHorizontal: gutter,
    backgroundColor: colors.surface,
  },
  image: {
    width: "100%",
    aspectRatio: 350 / 262,
    borderRadius: 4,
    backgroundColor: colors.fg,
  },
  confirm: { gap: 8, marginTop: 8 },
  confirmButtons: { flexDirection: "row", gap: 8 },
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
  vote: { flexDirection: "row", alignItems: "center", gap: 6 },
  voteDivider: { width: 1, height: 16, backgroundColor: "rgba(255, 255, 255, 0.25)" },
  pill: {
    height: 28,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  count: { color: colors.fg, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
});
