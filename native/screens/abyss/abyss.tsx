import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, PanResponder, StyleSheet, Text, View } from "react-native";
import type { FC } from "react";
import type { SvgProps } from "react-native-svg";

import CommentIcon from "../../../public/figma/post-comment.svg";
import ShareIcon from "../../../public/figma/post-share.svg";
import ReportIcon from "../../../public/figma/short-report.svg";
import LikeOffIcon from "../../../public/figma/v3-post-like-off.svg";
import LikeOnIcon from "../../../public/figma/v3-post-like-on.svg";
import DislikeOffIcon from "../../../public/figma/v3-post-dislike-off.svg";
import DislikeOnIcon from "../../../public/figma/v3-post-dislike-on.svg";
import SaveOffIcon from "../../../public/figma/v3-post-save-off.svg";
import SaveOnIcon from "../../../public/figma/v3-post-save-on.svg";
import type { NativeAbyssCover, NativeAbyssReady } from "../../../src/lib/native-screens";
import { Cover } from "../../ui/cards";
import { Comments, MenuSheet } from "../../ui/comments";
import { AppHeader } from "../../ui/header";
import { Button, ErrorRetry, MoreButton, Status, Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { PlaybackBar } from "../workspace/playback-bar";
import { Participants } from "./participants";
import { AbyssSheet } from "./sheet";

/** A three-page window keeps an unbounded web-owned feed independent of native list indices. */
const pages = ["previous", "current", "next"] as const;
type Page = (typeof pages)[number];

export function AbyssScreen({ model, header }: ScreenProps<"abyss">) {
  const { act, bottomInset } = useScreen();
  return (
    <View style={styles.root}>
      {header && <AppHeader header={header} />}
      <View style={[styles.root, { marginBottom: bottomInset }]}>
        {model.status === "ready" ? (
          <Pager model={model} />
        ) : model.status === "error" ? (
          <ErrorRetry
            message="숏폼을 불러오지 못했습니다."
            onRetry={() => act({ type: "abyss-retry" })}
          />
        ) : (
          <Status tone={model.status === "invalid" ? "error" : "muted"}>
            {model.status === "invalid"
              ? "올바르지 않은 페이지 주소입니다."
              : model.status === "loading"
                ? "숏폼을 불러오는 중입니다."
                : "아직 공개된 숏폼이 없습니다."}
          </Status>
        )}
      </View>
      {model.status === "ready" && model.sheet && (
        <AbyssSheet
          title={model.sheet.kind === "comments" ? "댓글" : "작곡 참여자"}
          onClose={() => act({ type: "abyss-close-sheet" })}
        >
          {model.sheet.kind === "comments" ? (
            <Comments comments={model.sheet.comments} />
          ) : (
            <Participants participants={model.sheet.participants} />
          )}
        </AbyssSheet>
      )}
    </View>
  );
}

function Pager({ model }: { model: NativeAbyssReady }) {
  const { act } = useScreen();
  const list = useRef<FlatList<Page>>(null);
  const [height, setHeight] = useState(0);
  const [width, setWidth] = useState(0);
  // A swipe is one action, including across cursor pages and wrap-around. The web decides the next ID.
  const move = (page: Page) => {
    list.current?.scrollToOffset({ offset: height, animated: false });
    if (page === "previous" && model.canPrevious) act({ type: "abyss-previous" });
    if (page === "next" && model.canNext) act({ type: "abyss-next" });
  };
  return (
    <View
      style={styles.root}
      onLayout={(event) => {
        setHeight(event.nativeEvent.layout.height);
        setWidth(event.nativeEvent.layout.width);
      }}
    >
      {height > 0 && width > 0 && (
        <FlatList
          key={height}
          ref={list}
          data={pages}
          extraData={model}
          keyExtractor={(page) => page}
          initialScrollIndex={1}
          getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
          pagingEnabled
          bounces={false}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!model.sheet && !model.advancing}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.y / height);
            if (index !== 1) move(pages[Math.max(0, Math.min(2, index))]);
          }}
          renderItem={({ item }) => (
            <View style={{ height, width }}>
              {item === "current" ? (
                <Short model={model} height={height} width={width} />
              ) : (
                <Preview
                  cover={item === "previous" ? model.previous : model.next}
                  size={Math.min(width - 80, 280)}
                />
              )}
            </View>
          )}
        />
      )}
    </View>
  );
}

function Preview({ cover, size }: { cover: NativeAbyssCover | null; size: number }) {
  return (
    <View style={styles.preview}>
      {cover ? (
        <>
          <Cover url={cover.albumImageUrl} size={size} radius={16} />
          <Text style={type.title} numberOfLines={2}>
            {cover.title}
          </Text>
        </>
      ) : (
        <ActivityIndicator color={colors.fg} />
      )}
    </View>
  );
}

function Short({
  model,
  height,
  width,
}: {
  model: NativeAbyssReady;
  height: number;
  width: number;
}) {
  const { act } = useScreen();
  const [menu, setMenu] = useState(false);
  const { short, playback } = model;
  const size = Math.max(100, Math.min(280, width - 80, height - 350));
  // Claim horizontal cover drags only: vertical drags remain with the paging FlatList.
  const gesture = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, state) =>
          Math.abs(state.dx) > 12 && Math.abs(state.dx) > Math.abs(state.dy) * 1.3,
        onPanResponderRelease: (_, state) => {
          if (Math.abs(state.dx) < 40) return;
          if (state.dx > 0 && model.canPrevious) act({ type: "abyss-previous" });
          if (state.dx < 0 && model.canNext) act({ type: "abyss-next" });
        },
      }),
    [act, model.canPrevious, model.canNext],
  );
  return (
    <View style={styles.short}>
      <View style={styles.song}>
        <View
          style={[styles.carousel, { height: size }]}
          {...gesture.panHandlers}
          accessibilityLabel="숏폼 앨범"
        >
          {model.previous && (
            <View
              style={[styles.sideCover, { right: width / 2 + size / 2 - 2 }]}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Cover url={model.previous.albumImageUrl} size={size} radius={16} />
            </View>
          )}
          <View accessibilityLabel={`${short.title} 앨범 커버`}>
            <Cover url={short.albumImageUrl} size={size} radius={16} />
          </View>
          {model.next && (
            <View
              style={[styles.sideCover, { left: width / 2 + size / 2 - 2 }]}
              pointerEvents="none"
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Cover url={model.next.albumImageUrl} size={size} radius={16} />
            </View>
          )}
        </View>
        <View style={styles.copy}>
          <Text style={type.title} numberOfLines={2} accessibilityRole="header">
            {short.title}
          </Text>
          <View style={styles.byline}>
            <Touchable
              accessibilityRole="button"
              onPress={() => act({ type: "abyss-profile", userId: short.author.userId })}
            >
              <Text style={type.body}>{short.author.nickname}</Text>
            </Touchable>
            <Text style={type.muted}>·</Text>
            <Touchable
              accessibilityRole="button"
              onPress={() => act({ type: "abyss-participants" })}
            >
              <Text style={type.body}>작곡 참여자 보기</Text>
            </Touchable>
          </View>
          <Text style={styles.counter} accessibilityLiveRegion="polite">
            {model.position} / {model.count}
          </Text>
        </View>
        <View style={styles.actions}>
          <Action
            label={`좋아요 ${short.likeCount}개`}
            icon={short.vote === "like" ? LikeOnIcon : LikeOffIcon}
            count={short.likeCount}
            selected={short.vote === "like"}
            disabled={model.busy}
            onPress={() => act({ type: "abyss-vote", vote: "like" })}
          />
          <Action
            label={`싫어요 ${short.dislikeCount}개`}
            icon={short.vote === "dislike" ? DislikeOnIcon : DislikeOffIcon}
            count={short.dislikeCount}
            selected={short.vote === "dislike"}
            disabled={model.busy}
            onPress={() => act({ type: "abyss-vote", vote: "dislike" })}
          />
          <Action
            label={`댓글 ${short.commentCount}개`}
            icon={CommentIcon}
            count={short.commentCount}
            onPress={() => act({ type: "abyss-comments" })}
          />
          <Action
            label="공유"
            icon={ShareIcon}
            disabled={model.busy}
            onPress={() => act({ type: "abyss-share" })}
          />
          <Action
            label={short.saved ? "저장 취소" : "저장"}
            icon={short.saved ? SaveOnIcon : SaveOffIcon}
            selected={short.saved}
            disabled={model.busy}
            onPress={() => act({ type: "abyss-save" })}
          />
          <MoreButton label="더보기" onPress={() => setMenu(true)} />
        </View>
      </View>
      <View style={styles.bottom}>
        <PlaybackBar
          player={{
            label: short.title,
            playing: playback.playing,
            muted: playback.muted,
            positionMs: playback.positionMs,
            durationMs: playback.totalMs || null,
            disabled: !playback.canPlay,
            loading: false,
            error: null,
          }}
          onToggle={() => act({ type: "abyss-toggle" })}
          onSeek={(ms) => act({ type: "abyss-seek", ms })}
          onMute={() => act({ type: "abyss-mute" })}
        />
        <View style={styles.navigation}>
          <Button
            label="이전 숏폼"
            tone="secondary"
            disabled={!model.canPrevious}
            onPress={() => act({ type: "abyss-previous" })}
          />
          <Button
            label="다음 숏폼"
            tone="secondary"
            disabled={!model.canNext}
            busy={model.advancing}
            onPress={() => act({ type: "abyss-next" })}
          />
        </View>
        {model.messages.map((message, index) => (
          <Text
            key={index}
            style={type.caption}
            accessibilityRole={message.alert ? "alert" : undefined}
          >
            {message.text}
          </Text>
        ))}
        {model.nextFailed && (
          <View accessibilityRole="alert">
            <Text style={type.caption}>다음 숏폼을 불러오지 못했습니다.</Text>
            <Button
              label="다시 시도"
              tone="secondary"
              disabled={!model.canNext}
              onPress={() => act({ type: "abyss-next" })}
            />
          </View>
        )}
        {model.feedback && (
          <Text style={type.caption} accessibilityLiveRegion="polite">
            {model.feedback}
          </Text>
        )}
        {model.join && (
          <Button
            label={model.join.label}
            tone={model.join.secondary ? "secondary" : "primary"}
            busy={model.join.busy}
            onPress={() => act({ type: "abyss-join" })}
          />
        )}
      </View>
      <MenuSheet
        label="게시글 옵션"
        visible={menu}
        onClose={() => setMenu(false)}
        items={[{ label: "신고", icon: ReportIcon, onPress: () => act({ type: "abyss-report" }) }]}
      />
    </View>
  );
}

function Action({
  label,
  icon: Icon,
  count,
  selected,
  disabled,
  onPress,
}: {
  label: string;
  icon: FC<SvgProps>;
  count?: number;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.action, disabled && styles.disabled]}
    >
      <Icon width={20} height={20} />
      {count !== undefined && <Text style={type.caption}>{count}</Text>}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  preview: { flex: 1, alignItems: "center", justifyContent: "center", gap: 20 },
  short: { flex: 1, justifyContent: "space-between", paddingVertical: 12, gap: 12 },
  song: { gap: 14 },
  carousel: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
  sideCover: { position: "absolute", opacity: 0.5, transform: [{ scale: 0.88 }] },
  copy: { paddingHorizontal: gutter, gap: 6 },
  byline: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  counter: { color: colors.muted, fontSize: 11 },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: gutter,
    gap: 8,
  },
  action: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 4 },
  disabled: { opacity: 0.4 },
  bottom: { paddingHorizontal: gutter, gap: 8 },
  navigation: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
});
