import { useRef, useState, type ReactNode } from "react";
import {
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type PressableProps,
  type ScrollViewInstance,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import Logo from "../public/figma/auth-logo.svg";
import ChatIcon from "../public/figma/abyss-comment.svg";
import LikeIcon from "../public/figma/like.svg";
import CommentIcon from "../public/figma/mini-comment.svg";
import DislikeIcon from "../public/figma/mini-dislike.svg";
import MoreIcon from "../public/figma/post-more.svg";
import BellIcon from "../public/figma/v3-bell.svg";
import SearchIcon from "../public/figma/v3-search.svg";
import defaultCover from "../src/features/abyss/assets/shortform-default-cover.png";
import type {
  NativeContentKind,
  NativeHome,
  NativeHomeAction,
  NativeList,
  NativePost,
  NativeSong,
  NativeWork,
} from "../src/lib/native-bridge-protocol";
import { designTokens } from "../src/styles/tokens";

const colors = designTokens.colors;
const ERROR = "#ff8d8d";
const RIPPLE = { color: "rgba(255, 255, 255, 0.12)" };

type Act = (action: NativeHomeAction) => void;
type MenuTarget = { kind: NativeContentKind; id: number; title: string; ownerId: number };

/** Same wording as the web home (src/features/home/home-screens.tsx, src/features/posts/post-list.tsx). */
const songStatus = {
  loading: "곡을 불러오는 중...",
  error: "곡을 불러오지 못했습니다.",
  empty: "아직 표시할 곡이 없어요.",
};
const postStatus = {
  loading: "게시글을 불러오는 중...",
  error: "게시글을 불러오지 못했습니다.",
  empty: "아직 게시글이 없어요.",
};

/**
 * The home drawn natively over the WebView. Data and every action belong to the web home page
 * (src/features/home/native-home-bridge.tsx); this only renders its view model.
 */
export function HomeScreen({
  home,
  origin,
  bottomInset,
  style,
  onAction,
}: {
  home: NativeHome;
  /** Origin of the bundled web server, which redirects legacy relative /files/... URLs. */
  origin: string;
  /** Space kept free at the bottom for the tab bar. */
  bottomInset: number;
  style?: StyleProp<ViewStyle>;
  onAction: Act;
}) {
  const scroll = useRef<ScrollViewInstance>(null);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  // The pull-to-refresh spinner runs until the web reports the refresh it asked for as done.
  const [refreshTarget, setRefreshTarget] = useState<number | null>(null);
  const refreshing = refreshTarget !== null && home.refreshed < refreshTarget;
  const uri = (url: string | null) => {
    const trimmed = url?.trim();
    return trimmed ? (trimmed.startsWith("/") ? `${origin}${trimmed}` : trimmed) : null;
  };
  const signedIn = home.userId !== null;

  return (
    <View style={[styles.screen, style]}>
      <Header
        home={home}
        avatarUri={uri(home.profileImageUrl)}
        onLogo={() => scroll.current?.scrollTo({ y: 0, animated: true })}
        onAction={onAction}
      />
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ paddingTop: 8, paddingBottom: bottomInset + 24 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.fg}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
            onRefresh={() => {
              setRefreshTarget(home.refreshed + 1);
              onAction({ type: "refresh" });
            }}
          />
        }
      >
        {home.works && <WorksSection works={home.works} onAction={onAction} />}
        <Section title="인기 차트" onAll={() => onAction({ type: "show-songs", kind: "popular" })}>
          <SongRail list={home.popular} uri={uri} onAction={onAction} onMenu={setMenu} />
        </Section>
        <Section
          title="추천 음악"
          onAll={() => onAction({ type: "show-songs", kind: "recommended" })}
        >
          <SongRail list={home.recommended} uri={uri} onAction={onAction} onMenu={setMenu} />
        </Section>
        <Section title="인기 게시글" onAll={() => onAction({ type: "open-posts" })}>
          {home.posts.status !== "ready" || home.posts.items.length === 0 ? (
            <Status>
              {postStatus[home.posts.status === "ready" ? "empty" : home.posts.status]}
            </Status>
          ) : (
            <View style={styles.posts}>
              {home.posts.items.map((post) => (
                <PostRow
                  key={post.postId}
                  post={post}
                  uri={uri}
                  onOpen={() => onAction({ type: "open-post", postId: post.postId })}
                  onMenu={() =>
                    setMenu({
                      kind: "post",
                      id: post.postId,
                      title: post.title,
                      ownerId: post.ownerId,
                    })
                  }
                />
              ))}
            </View>
          )}
        </Section>
        {signedIn && home.mine && (
          <Section title="내 음악" onAll={() => onAction({ type: "show-songs", kind: "mine" })}>
            <SongRail list={home.mine} uri={uri} onAction={onAction} />
          </Section>
        )}
      </ScrollView>
      <ContentMenu
        target={menu}
        canReport={menu !== null && menu.ownerId !== home.userId}
        onClose={() => setMenu(null)}
        onAction={onAction}
      />
    </View>
  );
}

function Touchable({ style, ...props }: PressableProps & { style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      android_ripple={RIPPLE}
      style={({ pressed }) => [style, pressed && Platform.OS === "ios" && styles.pressed]}
      {...props}
    />
  );
}

function Header({
  home,
  avatarUri,
  onLogo,
  onAction,
}: {
  home: NativeHome;
  avatarUri: string | null;
  onLogo: () => void;
  onAction: Act;
}) {
  const signedIn = home.userId !== null;
  return (
    <View style={styles.header}>
      <Touchable accessibilityRole="button" accessibilityLabel="맨 위로" onPress={onLogo}>
        <Logo width={68} height={43} />
      </Touchable>
      <View style={styles.headerActions}>
        <HeaderButton
          label={home.unreadNotifications ? `알림, 미확인 ${home.unreadNotifications}개` : "알림"}
          count={home.unreadNotifications}
          onPress={() => onAction({ type: "notifications" })}
        >
          <BellIcon width={22} height={26} />
        </HeaderButton>
        {signedIn && (
          <HeaderButton
            label={
              home.unreadChats ? `대화 목록, 읽지 않은 메시지 ${home.unreadChats}개` : "대화 목록"
            }
            count={home.unreadChats}
            onPress={() => onAction({ type: "chat" })}
          >
            <ChatIcon width={20} height={20} />
          </HeaderButton>
        )}
        <HeaderButton label="검색" onPress={() => onAction({ type: "search" })}>
          <SearchIcon width={24} height={24} />
        </HeaderButton>
        {signedIn ? (
          <HeaderButton label="프로필" onPress={() => onAction({ type: "profile" })}>
            <Avatar uri={avatarUri} size={32} />
          </HeaderButton>
        ) : (
          <Touchable
            accessibilityRole="button"
            style={styles.loginButton}
            onPress={() => onAction({ type: "login" })}
          >
            <Text style={styles.loginText}>로그인</Text>
          </Touchable>
        )}
      </View>
    </View>
  );
}

function HeaderButton({
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
      style={styles.headerButton}
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

function Section({
  title,
  onAll,
  children,
}: {
  title: string;
  onAll?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Text style={styles.sectionTitle} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {onAll && (
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={`${title} 모두보기`}
            hitSlop={8}
            onPress={onAll}
          >
            <Text style={styles.sectionAll}>모두보기</Text>
          </Touchable>
        )}
      </View>
      {children}
    </View>
  );
}

function Status({ children, tone = "muted" }: { children: string; tone?: "muted" | "error" }) {
  return (
    <Text
      accessibilityRole={tone === "error" ? "alert" : undefined}
      style={[styles.status, tone === "error" && { color: ERROR }]}
    >
      {children}
    </Text>
  );
}

function SongRail({
  list,
  uri,
  onAction,
  onMenu,
}: {
  list: NativeList<NativeSong>;
  uri: (url: string | null) => string | null;
  onAction: Act;
  /** Shows the share/report menu button on each card. */
  onMenu?: (target: MenuTarget) => void;
}) {
  if (list.status !== "ready" || list.items.length === 0)
    return <Status>{songStatus[list.status === "ready" ? "empty" : list.status]}</Status>;
  return (
    <FlatList
      horizontal
      data={list.items}
      keyExtractor={(song) => String(song.shortId)}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      renderItem={({ item: song }) => {
        const cover = uri(song.albumImageUrl);
        return (
          <View style={styles.songCard}>
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={`${song.title} 열기`}
              onPress={() => onAction({ type: "open-short", shortId: song.shortId })}
            >
              <Image
                source={cover ? { uri: cover } : defaultCover}
                style={styles.songArt}
                accessibilityIgnoresInvertColors
              />
              <View style={styles.songCopy}>
                <Text style={styles.songTitle} numberOfLines={1}>
                  {song.title}
                </Text>
                <Text style={styles.songAuthor} numberOfLines={1}>
                  {song.author}
                </Text>
              </View>
            </Touchable>
            {onMenu && (
              <MoreButton
                label={`${song.title} 더보기`}
                style={styles.songMore}
                onPress={() =>
                  onMenu({
                    kind: "short",
                    id: song.shortId,
                    title: song.title,
                    ownerId: song.ownerId,
                  })
                }
              />
            )}
          </View>
        );
      }}
    />
  );
}

function MoreButton({
  label,
  style,
  onPress,
}: {
  label: string;
  style?: StyleProp<ViewStyle>;
  onPress: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={[styles.more, style]}
      onPress={onPress}
    >
      <MoreIcon width={20} height={20} />
    </Touchable>
  );
}

function PostRow({
  post,
  uri,
  onOpen,
  onMenu,
}: {
  post: NativePost;
  uri: (url: string | null) => string | null;
  onOpen: () => void;
  onMenu: () => void;
}) {
  const image = uri(post.imageUrl);
  return (
    <View style={styles.postRow}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`${post.title} 게시글 열기`}
        style={styles.postMain}
        onPress={onOpen}
      >
        <View style={styles.postThumb}>
          {image && <Image source={{ uri: image }} style={StyleSheet.absoluteFill} />}
        </View>
        <View style={styles.postCopy}>
          <Text style={styles.postExcerpt} numberOfLines={2}>
            {post.excerpt}
          </Text>
          <View style={styles.postAuthor}>
            <Avatar uri={uri(post.writer.profileImageUrl)} size={16} />
            <Text style={styles.postMeta} numberOfLines={1}>
              {post.writer.nickname}
            </Text>
          </View>
          <View style={styles.postStats} accessibilityLabel="게시글 통계">
            <Text style={styles.postMeta}>{post.createdLabel}</Text>
            <Stat icon={<LikeIcon width={13} height={13} />} value={post.likeCount} />
            <Stat icon={<DislikeIcon width={13} height={13} />} value={post.dislikeCount} />
            <Stat icon={<CommentIcon width={13} height={13} />} value={post.commentCount} />
          </View>
        </View>
      </Touchable>
      <MoreButton label={`${post.title} 더보기`} onPress={onMenu} />
    </View>
  );
}

function Stat({ icon, value }: { icon: ReactNode; value: number }) {
  return (
    <View style={styles.stat}>
      {icon}
      <Text style={styles.postMeta}>{value}</Text>
    </View>
  );
}

function WorksSection({
  works,
  onAction,
}: {
  works: NonNullable<NativeHome["works"]>;
  onAction: Act;
}) {
  const hasItems = works.items.length > 0;
  return (
    <Section
      title="이 기기에서 연 작업"
      onAll={hasItems ? () => onAction({ type: "open-workspace" }) : undefined}
    >
      {works.error && <Status tone="error">{works.error}</Status>}
      {works.loading && <Status>방문한 작업을 불러오는 중입니다.</Status>}
      {hasItems ? (
        <FlatList
          horizontal
          data={works.items}
          keyExtractor={(work) => String(work.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.rail, { gap: 12 }]}
          renderItem={({ item }) => <WorkCard work={item} onAction={onAction} />}
        />
      ) : (
        !works.loading &&
        !works.error && (
          <View style={styles.worksEmpty}>
            <Text style={styles.worksEmptyText}>새 곡을 만들거나 음악에 참여해 보세요.</Text>
            <Touchable
              accessibilityRole="button"
              style={styles.primaryButton}
              onPress={() => onAction({ type: "start-song" })}
            >
              <Text style={styles.primaryButtonText}>작곡 시작하기</Text>
            </Touchable>
          </View>
        )
      )}
    </Section>
  );
}

function WorkCard({ work, onAction }: { work: NativeWork; onAction: Act }) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={`${work.title} 이어서 작곡하기`}
      style={styles.workCard}
      onPress={() => onAction({ type: "resume", projectId: work.id, shortId: work.shortId })}
    >
      <View style={styles.workTop}>
        <Text style={styles.postMeta}>{work.visitedLabel ?? "작업 중"}</Text>
        <Svg
          width={18}
          height={18}
          viewBox="0 0 24 24"
          fill="none"
          stroke={colors.muted}
          strokeWidth={1.5}
        >
          <Path d="M7 17 17 7M7 7h10v10" strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
      <WorkPreview tracks={work.preview} />
      <View>
        <Text style={styles.workTitle} numberOfLines={1}>
          {work.title}
        </Text>
        <Text style={styles.workMeta}>
          레이어 {work.layerCount}개 · {work.bpm} BPM
        </Text>
      </View>
    </Touchable>
  );
}

/** Same drawing as the web's DraftPreview: a 240×88 grid with each track's clips as bars. */
function WorkPreview({ tracks }: { tracks: NativeWork["preview"] }) {
  return (
    <Svg
      width="100%"
      height={78}
      viewBox="0 0 240 88"
      preserveAspectRatio="none"
      style={styles.preview}
    >
      <Rect width={240} height={88} fill={colors.panel} />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <Path key={`v${i}`} d={`M${i * 30} 0V88`} stroke={colors.border} strokeWidth={0.6} />
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <Path key={`h${i}`} d={`M0 ${i * 22}H240`} stroke={colors.border} strokeWidth={0.6} />
      ))}
      {tracks.map((clips, row) =>
        clips.map((clip, index) => (
          <Rect
            key={`${row}-${index}`}
            x={clip.start * 232 + 4}
            y={row * 22 + 5}
            width={Math.max(3, clip.length * 232 - 4)}
            height={12}
            rx={3}
            fill={colors.primary}
            opacity={1 - row * 0.16}
          />
        )),
      )}
    </Svg>
  );
}

function Avatar({ uri, size }: { uri: string | null; size: number }) {
  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} accessibilityLabel="프로필" />
      ) : (
        // The web's fallback: a person outline (lucide UserRound) on grey.
        <Svg
          width={size * 0.58}
          height={size * 0.58}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth={2}
          accessibilityLabel="프로필"
        >
          <Circle cx={12} cy={8} r={5} />
          <Path d="M20 21a8 8 0 0 0-16 0" strokeLinecap="round" />
        </Svg>
      )}
    </View>
  );
}

/** Share/report sheet of a card; the web performs both (login check, share link, report form). */
function ContentMenu({
  target,
  canReport,
  onClose,
  onAction,
}: {
  target: MenuTarget | null;
  canReport: boolean;
  onClose: () => void;
  onAction: Act;
}) {
  const choose = (type: "share" | "report") => {
    if (!target) return;
    onClose();
    onAction({ type, kind: target.kind, id: target.id, title: target.title });
  };
  return (
    <Modal
      visible={target !== null}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.menuRoot}>
        <Pressable
          style={styles.menuBackdrop}
          accessibilityRole="button"
          accessibilityLabel="닫기"
          onPress={onClose}
        />
        <View style={styles.menuSheet} accessibilityRole="menu">
          <Text style={styles.menuTitle} numberOfLines={1}>
            {target?.title}
          </Text>
          <MenuItem label="공유" onPress={() => choose("share")} />
          {canReport && <MenuItem label="신고" onPress={() => choose("report")} />}
          <MenuItem label="취소" muted onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function MenuItem({
  label,
  muted = false,
  onPress,
}: {
  label: string;
  muted?: boolean;
  onPress: () => void;
}) {
  return (
    <Touchable accessibilityRole="menuitem" style={styles.menuItem} onPress={onPress}>
      <Text style={[styles.menuItemText, muted && { color: colors.muted }]}>{label}</Text>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  screen: { ...StyleSheet.absoluteFill, backgroundColor: colors.bg },
  pressed: { opacity: 0.6 },
  header: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingLeft: 16,
    paddingRight: 8,
  },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 4 },
  headerButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
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
    backgroundColor: "#ef4444",
    borderWidth: 2,
    borderColor: colors.bg,
  },
  badgeText: { color: "#ffffff", fontSize: 10, fontWeight: "600", lineHeight: 12 },
  loginButton: {
    height: 34,
    marginRight: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  loginText: { color: colors.fg, fontSize: 14, fontWeight: "600" },
  section: { marginBottom: 32 },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitle: { flex: 1, color: colors.fg, fontSize: 20, lineHeight: 26, fontWeight: "700" },
  sectionAll: { color: colors.muted, fontSize: 16, lineHeight: 20, fontWeight: "500" },
  status: {
    paddingHorizontal: 20,
    paddingVertical: 32,
    textAlign: "center",
    color: colors.muted,
    fontSize: 14,
    lineHeight: 20,
  },
  rail: { paddingHorizontal: 20, gap: 20 },
  songCard: { width: 160 },
  songArt: {
    width: 160,
    height: 160,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  songCopy: { paddingRight: 28, gap: 4 },
  songTitle: { color: colors.fg, fontSize: 16, lineHeight: 20, fontWeight: "700" },
  songAuthor: { color: colors.muted, fontSize: 14, lineHeight: 18 },
  songMore: { position: "absolute", right: -4, top: 168 },
  more: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  posts: { paddingHorizontal: 20, gap: 12 },
  postRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  postMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  postThumb: {
    width: 72,
    height: 72,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  postCopy: { flex: 1, gap: 6 },
  postExcerpt: { color: colors.fg, fontSize: 15, lineHeight: 20, fontWeight: "600" },
  postAuthor: { flexDirection: "row", alignItems: "center", gap: 6 },
  postStats: { flexDirection: "row", alignItems: "center", gap: 10 },
  postMeta: { color: colors.muted, fontSize: 12, lineHeight: 16 },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
  avatar: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#949494",
  },
  workCard: {
    width: 244,
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  workTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  preview: { borderRadius: 6, overflow: "hidden" },
  workTitle: { color: colors.fg, fontSize: 16, lineHeight: 22, fontWeight: "600" },
  workMeta: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  worksEmpty: {
    marginHorizontal: 20,
    padding: 20,
    gap: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  worksEmptyText: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  primaryButton: {
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  primaryButtonText: { color: colors.fg, fontSize: 16, fontWeight: "600" },
  menuRoot: { flex: 1, justifyContent: "flex-end" },
  menuBackdrop: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0, 0, 0, 0.6)" },
  menuSheet: {
    paddingTop: 8,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: colors.surface,
  },
  menuTitle: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    color: colors.muted,
    fontSize: 14,
    textAlign: "center",
  },
  menuItem: { height: 56, justifyContent: "center", paddingHorizontal: 20 },
  menuItemText: { color: colors.fg, fontSize: 16, textAlign: "center" },
});
