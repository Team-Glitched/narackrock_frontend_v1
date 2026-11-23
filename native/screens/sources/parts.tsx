import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import CommentIcon from "../../../public/figma/post-comment.svg";
import ShareIcon from "../../../public/figma/post-share.svg";
import ReportIcon from "../../../public/figma/short-report.svg";
import DislikeOffIcon from "../../../public/figma/v3-post-dislike-off.svg";
import DislikeOnIcon from "../../../public/figma/v3-post-dislike-on.svg";
import LikeOffIcon from "../../../public/figma/v3-post-like-off.svg";
import LikeOnIcon from "../../../public/figma/v3-post-like-on.svg";
import SaveOffIcon from "../../../public/figma/v3-post-save-off.svg";
import SaveOnIcon from "../../../public/figma/v3-post-save-on.svg";
import type { NativePlayback, NativeSourceWriter } from "../../../src/lib/native-screens";
import { MenuSheet } from "../../ui/comments";
import { Avatar, Button, MoreButton, Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";
import { PlaybackBar } from "../workspace/playback-bar";

export function SourceLogin({ children }: { children: string }) {
  const { act } = useScreen();
  return (
    <View style={styles.column}>
      <Text style={type.body}>{children}</Text>
      <Button label="로그인" onPress={() => act({ type: "sign-in" })} />
    </View>
  );
}

export function SourceAuthor({
  writer,
  onPress,
}: {
  writer: NativeSourceWriter;
  onPress: () => void;
}) {
  const { uri } = useScreen();
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={`${writer.nickname} 프로필`}
      style={[styles.row, styles.authorRow]}
      onPress={onPress}
    >
      <Avatar uri={uri(writer.profileImageUrl)} size={16} />
      <Text style={styles.authorName} numberOfLines={1}>
        {writer.nickname}
      </Text>
    </Touchable>
  );
}

export function SourcePlayer({
  player,
  canPreview,
  durationHint = false,
  onToggle,
  onSeek,
  onMute,
}: {
  player: NativePlayback | null;
  canPreview: boolean;
  durationHint?: boolean;
  onToggle: () => void;
  onSeek: (ms: number) => void;
  onMute: () => void;
}) {
  if (!canPreview)
    return <Text style={type.caption}>이 샘플은 현재 미리듣기를 사용할 수 없습니다.</Text>;
  if (!player) return null;
  return (
    <View style={styles.player}>
      <PlaybackBar player={player} onToggle={onToggle} onSeek={onSeek} onMute={onMute} />
      {player.error && (
        <Text accessibilityRole="alert" style={styles.error}>
          {player.error}
        </Text>
      )}
      {durationHint && player.durationMs === null && (
        <Text style={type.caption}>재생 시간 정보 없음</Text>
      )}
    </View>
  );
}

export function SourceActions({
  source,
  busy = false,
  onVote,
  onComments,
  onSave,
  onShare,
  onReport,
}: {
  source: {
    likeCount: number;
    dislikeCount: number;
    commentCount: number;
    vote: "like" | "dislike" | null;
    saved: boolean;
  };
  busy?: boolean;
  onVote?: (vote: "like" | "dislike") => void;
  onComments: () => void;
  onSave?: () => void;
  onShare?: () => void;
  onReport?: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const Like = source.vote === "like" ? LikeOnIcon : LikeOffIcon;
  const Dislike = source.vote === "dislike" ? DislikeOnIcon : DislikeOffIcon;
  const Save = source.saved ? SaveOnIcon : SaveOffIcon;
  return (
    <View style={styles.actions}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`좋아요 ${source.likeCount}개`}
        accessibilityState={{ selected: source.vote === "like", disabled: busy || !onVote }}
        disabled={busy || !onVote}
        style={styles.stat}
        onPress={() => onVote?.("like")}
      >
        <Like width={18} height={18} />
        <Text style={type.caption}>{source.likeCount}</Text>
      </Touchable>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`싫어요 ${source.dislikeCount}개`}
        accessibilityState={{ selected: source.vote === "dislike", disabled: busy || !onVote }}
        disabled={busy || !onVote}
        style={styles.stat}
        onPress={() => onVote?.("dislike")}
      >
        <Dislike width={18} height={18} />
        <Text style={type.caption}>{source.dislikeCount}</Text>
      </Touchable>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`댓글 ${source.commentCount}개 보기`}
        style={styles.stat}
        onPress={onComments}
      >
        <CommentIcon width={18} height={18} />
        <Text style={type.caption}>{source.commentCount}</Text>
      </Touchable>
      {onSave && (
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={source.saved ? "저장됨" : "저장"}
          accessibilityState={{ selected: source.saved, disabled: busy }}
          disabled={busy}
          style={styles.stat}
          onPress={onSave}
        >
          <Save width={20} height={20} />
        </Touchable>
      )}
      {onShare && (
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="공유"
          style={styles.stat}
          onPress={onShare}
        >
          <ShareIcon width={20} height={20} />
        </Touchable>
      )}
      {onReport && (
        <>
          <MoreButton label="샘플 더보기" onPress={() => setMenu(true)} />
          <MenuSheet
            label="샘플 옵션"
            visible={menu}
            items={[{ label: "신고", icon: ReportIcon, onPress: onReport }]}
            onClose={() => setMenu(false)}
          />
        </>
      )}
    </View>
  );
}

export const styles = StyleSheet.create({
  column: { padding: gutter, gap: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  authorRow: { gap: 8 },
  authorName: { flexShrink: 1, color: colors.fg, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  title: { flex: 1, minWidth: 0, gap: 3 },
  player: { gap: 8, marginTop: 4, marginBottom: 4 },
  hintBox: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    lineHeight: 20,
    color: colors.muted,
  },
  actions: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  stat: { flexDirection: "row", alignItems: "center", gap: 2, minHeight: 36, paddingHorizontal: 2 },
  error: { ...type.caption, color: colors.error },
  heading: { ...type.title, marginBottom: 12 },
  input: {
    color: colors.fg,
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    minHeight: 44,
  },
  field: { gap: 8 },
  copy: { ...type.body, lineHeight: 24 },
});
