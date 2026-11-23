import type { ReactNode } from "react";
import { FlatList, Image, StyleSheet, Text, View } from "react-native";

import CommentIcon from "../../public/figma/post-comment.svg";
import DislikeIcon from "../../public/figma/v3-post-dislike-off.svg";
import LikeIcon from "../../public/figma/v3-post-like-off.svg";
import defaultCover from "../../src/features/abyss/assets/shortform-default-cover.png";
import type { NativeList, NativePost, NativeSong } from "../../src/lib/native-screens";
import { Avatar, MoreButton, Status, Touchable } from "./kit";
import { useScreen } from "./screen-context";
import { colors, gutter, type } from "./theme";

/** Same wording as the web (src/features/home/home-screens.tsx, src/features/posts/post-list.tsx). */
export const songStatus = {
  loading: "곡을 불러오는 중...",
  error: "곡을 불러오지 못했습니다.",
  empty: "아직 표시할 곡이 없어요.",
};
export const postStatus = {
  loading: "게시글을 불러오는 중...",
  error: "게시글을 불러오지 못했습니다.",
  empty: "아직 게시글이 없어요.",
};

/** Album cover, or the web's default shortform cover. */
export function Cover({
  url,
  size,
  radius = 8,
}: {
  url: string | null;
  size: number;
  radius?: number;
}) {
  const { uri } = useScreen();
  const resolved = uri(url);
  return (
    <Image
      source={resolved ? { uri: resolved } : defaultCover}
      style={{ width: size, height: size, borderRadius: radius, backgroundColor: colors.surface }}
      accessibilityIgnoresInvertColors
    />
  );
}

/** Horizontal rail of 160px song cards (the web's SongRail). */
export function SongRail({
  list,
  onOpen,
  menu = false,
}: {
  list: NativeList<NativeSong>;
  onOpen: (shortId: number) => void;
  /** Shows the share/report menu button on each card. */
  menu?: boolean;
}) {
  const { openMenu } = useScreen();
  if (list.status !== "ready" || list.items.length === 0)
    return <Status>{songStatus[list.status === "ready" ? "empty" : list.status]}</Status>;
  return (
    <FlatList
      horizontal
      data={list.items}
      keyExtractor={(song) => String(song.shortId)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      renderItem={({ item: song }) => (
        <View style={styles.songCard}>
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={`${song.title} 열기`}
            onPress={() => onOpen(song.shortId)}
          >
            <View style={styles.songArt}>
              <Cover url={song.albumImageUrl} size={160} radius={10} />
            </View>
            <View style={styles.songCopy}>
              <Text style={styles.songTitle} numberOfLines={1}>
                {song.title}
              </Text>
              <Text style={type.muted} numberOfLines={1}>
                {song.author}
              </Text>
            </View>
          </Touchable>
          {menu && (
            <MoreButton
              label={`${song.title} 더보기`}
              style={styles.songMore}
              onPress={() =>
                openMenu({
                  kind: "short",
                  id: song.shortId,
                  title: song.title,
                  ownerId: song.ownerId,
                })
              }
            />
          )}
        </View>
      )}
    />
  );
}

/** A chart-style row (the web's chartRow): cover, title, subtitle, and a trailing slot. */
export function MediaRow({
  title,
  subtitle,
  coverUrl,
  onOpen,
  trailing,
}: {
  title: string;
  subtitle: string;
  coverUrl: string | null;
  onOpen: () => void;
  trailing?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`${title} 열기`}
        style={styles.rowMain}
        onPress={onOpen}
      >
        <Cover url={coverUrl} size={56} />
        <View style={styles.rowCopy}>
          <Text style={type.label} numberOfLines={1}>
            {title}
          </Text>
          <Text style={type.muted} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Touchable>
      {trailing}
    </View>
  );
}

export function SongRow({
  song,
  onOpen,
  trailing,
}: {
  song: NativeSong;
  onOpen: () => void;
  trailing?: ReactNode;
}) {
  return (
    <MediaRow
      title={song.title}
      subtitle={song.author}
      coverUrl={song.albumImageUrl}
      onOpen={onOpen}
      trailing={trailing}
    />
  );
}

/** A user row: avatar and nickname. */
export function PersonRow({
  nickname,
  profileImageUrl,
  onOpen,
  trailing,
}: {
  nickname: string;
  profileImageUrl: string | null;
  onOpen: () => void;
  trailing?: ReactNode;
}) {
  const { uri } = useScreen();
  return (
    <View style={styles.row}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`${nickname} 프로필 열기`}
        style={styles.rowMain}
        onPress={onOpen}
      >
        <Avatar uri={uri(profileImageUrl)} size={40} />
        <Text style={[type.label, styles.flex]} numberOfLines={1}>
          {nickname}
        </Text>
      </Touchable>
      {trailing}
    </View>
  );
}

/** The share/report button of a song row. */
export function SongMenuButton({ song }: { song: NativeSong }) {
  const { openMenu } = useScreen();
  return (
    <MoreButton
      label={`${song.title} 더보기`}
      onPress={() =>
        openMenu({ kind: "short", id: song.shortId, title: song.title, ownerId: song.ownerId })
      }
    />
  );
}

/** A post row (the web's MiniPost); `tall` is the larger thumbnail of full lists. */
export function PostRow({
  post,
  onOpen,
  tall = false,
}: {
  post: NativePost;
  onOpen: () => void;
  tall?: boolean;
}) {
  const { uri, openMenu } = useScreen();
  const image = uri(post.imageUrl);
  const thumb = tall ? 96 : 72;
  return (
    <View style={styles.postRow}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`${post.title} 게시글 열기`}
        style={styles.rowMain}
        onPress={onOpen}
      >
        <View style={[styles.postThumb, { width: thumb, height: thumb }]}>
          {image && <Image source={{ uri: image }} style={StyleSheet.absoluteFill} />}
        </View>
        <View style={styles.postCopy}>
          <Text style={styles.postExcerpt} numberOfLines={2}>
            {post.excerpt}
          </Text>
          <View style={styles.postAuthor}>
            <Avatar uri={uri(post.writer.profileImageUrl)} size={16} />
            <Text style={type.caption} numberOfLines={1}>
              {post.writer.nickname}
            </Text>
          </View>
          <View style={styles.postStats} accessibilityLabel="게시글 통계">
            <Text style={[type.caption, styles.postTime]} numberOfLines={1}>
              {post.createdLabel}
            </Text>
            <View style={styles.postStatGroup}>
              <Stat icon={<LikeIcon width={13} height={13} />} value={post.likeCount} />
              <Stat icon={<DislikeIcon width={13} height={13} />} value={post.dislikeCount} />
              <Stat icon={<CommentIcon width={13} height={13} />} value={post.commentCount} />
            </View>
          </View>
        </View>
      </Touchable>
      <MoreButton
        label={`${post.title} 더보기`}
        onPress={() =>
          openMenu({ kind: "post", id: post.postId, title: post.title, ownerId: post.ownerId })
        }
      />
    </View>
  );
}

function Stat({ icon, value }: { icon: ReactNode; value: number }) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={type.caption}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { paddingHorizontal: gutter, gap: 20 },
  songCard: { width: 160 },
  songArt: { marginBottom: 10 },
  songCopy: { paddingRight: 28, gap: 4 },
  songTitle: { color: colors.fg, fontSize: 16, lineHeight: 20, fontWeight: "700" },
  songMore: { position: "absolute", right: -4, top: 168 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: gutter },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  rowCopy: { flex: 1, gap: 4 },
  flex: { flex: 1 },
  postRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: gutter },
  postThumb: { borderRadius: 8, overflow: "hidden", backgroundColor: colors.surface },
  postCopy: { flex: 1, gap: 6 },
  postExcerpt: { color: colors.fg, fontSize: 15, lineHeight: 20, fontWeight: "600" },
  postAuthor: { flexDirection: "row", alignItems: "center", gap: 6 },
  postStats: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingRight: 4 },
  postTime: { flexShrink: 1 },
  postStatGroup: { flexDirection: "row", alignItems: "center", gap: 10 },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
});
