/**
 * The web abyss (src/features/abyss/abyss-screen.tsx AbyssView, src/styles/abyss.styles.ts) drawn
 * natively. The web lays it out on the 390×844 design canvas: the abyss view gets the 390×688 area
 * between the header and the footer. This screen lays it out in the same design px, multiplied by
 * the scale that fits that area, so cover, title, reactions, player and join button keep the web's
 * sizes and spacing.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type TextStyle,
} from "react-native";
import type { FC } from "react";
import type { SvgProps } from "react-native-svg";

import PlayerIcon from "../../../public/figma/abyss-player.svg";
import CommentIcon from "../../../public/figma/post-comment.svg";
import ShareIcon from "../../../public/figma/post-share.svg";
import ReportIcon from "../../../public/figma/short-report.svg";
import DislikeOffIcon from "../../../public/figma/v3-post-dislike-off.svg";
import DislikeOnIcon from "../../../public/figma/v3-post-dislike-on.svg";
import LikeOffIcon from "../../../public/figma/v3-post-like-off.svg";
import LikeOnIcon from "../../../public/figma/v3-post-like-on.svg";
import SaveOffIcon from "../../../public/figma/v3-post-save-off.svg";
import SaveOnIcon from "../../../public/figma/v3-post-save-on.svg";
import type { NativeAbyssCover, NativeAbyssReady } from "../../../src/lib/native-screens";
import { Cover } from "../../ui/cards";
import { Comments } from "../../ui/comments";
import { AppHeader } from "../../ui/header";
import { Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { useSmoothPlaybackMs } from "../../ui/smooth-playback";
import { colors, fontFamily } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { Participants } from "./participants";
import { AbyssSheet } from "./sheet";

/** The web's abyss view area on the design canvas: 844 − frame padding 40 − header 48 − body padding 16 − footer 56. */
const DESIGN = { width: 390, height: 684 };
/** Cover track: 300px covers 60px apart (`--cover-step: 360px`), the first 25px from the left. */
const COVER = { size: 300, step: 360, left: 25, top: 10, viewport: 320 };
const SLIDE = { duration: 320, easing: Easing.bezier(0.22, 0.61, 0.36, 1) };
const PROGRESS = { fill: "#f2f4f6", rest: "#303030" };
const TOGGLE_INK = "#232323";

/** Design px → dp at the screen's scale. */
type Px = (value: number) => number;

export function AbyssScreen({ model, header }: ScreenProps<"abyss">) {
  const { act, bottomInset } = useScreen();
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  // An open sheet covers the footer (the page drops it meanwhile); keep the last inset so the page
  // under the sheet does not move.
  const [inset, setInset] = useState(bottomInset);
  if (bottomInset > 0 && inset !== bottomInset) setInset(bottomInset);
  const scale = size ? Math.min(1, size.width / DESIGN.width, size.height / DESIGN.height) : 0;
  const px: Px = (value) => value * scale;
  return (
    <View style={styles.root}>
      {header && <AppHeader header={header} />}
      <View
        style={[styles.root, { marginBottom: inset }]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setSize({ width, height });
        }}
      >
        {scale > 0 &&
          (model.status === "ready" ? (
            <Short model={model} px={px} />
          ) : (
            <State px={px} status={model.status} onRetry={() => act({ type: "abyss-retry" })} />
          ))}
      </View>
      {model.status === "ready" && model.sheet && scale > 0 && (
        <AbyssSheet
          title={model.sheet.kind === "comments" ? "댓글" : "작곡 참여자"}
          px={px}
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

/** The web's abyss-state: a centered line, and the primary "다시 시도" after an error. */
function State({
  px,
  status,
  onRetry,
}: {
  px: Px;
  status: "invalid" | "loading" | "error" | "empty";
  onRetry: () => void;
}) {
  const message =
    status === "invalid"
      ? "올바르지 않은 페이지 주소입니다."
      : status === "error"
        ? "숏폼을 불러오지 못했습니다."
        : status === "loading"
          ? "숏폼을 불러오는 중입니다."
          : "아직 공개된 숏폼이 없습니다.";
  return (
    <View
      style={[styles.state, { gap: px(12), paddingHorizontal: px(20) }]}
      accessibilityRole={status === "error" || status === "invalid" ? "alert" : undefined}
      accessibilityLiveRegion="polite"
    >
      <Text allowFontScaling={false} style={[text(px, 16, 22, "400"), styles.muted]}>
        {message}
      </Text>
      {status === "error" && (
        <Touchable
          accessibilityRole="button"
          style={[
            styles.retry,
            { borderRadius: px(20), paddingVertical: px(8), paddingHorizontal: px(16) },
          ]}
          onPress={onRetry}
        >
          <Text allowFontScaling={false} style={[text(px, 16, 22, "400"), styles.white]}>
            다시 시도
          </Text>
        </Touchable>
      )}
    </View>
  );
}

function Short({ model, px }: { model: NativeAbyssReady; px: Px }) {
  const { act } = useScreen();
  const { short, playback } = model;
  /** Which way the last move went, so the carousel slides the new cover in from that side. */
  const direction = useRef<"next" | "previous" | null>(null);
  const previous = () => {
    if (!model.canPrevious) return;
    direction.current = "previous";
    act({ type: "abyss-previous" });
  };
  const next = () => {
    if (!model.canNext) return;
    direction.current = "next";
    act({ type: "abyss-next" });
  };
  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.view,
        {
          width: px(DESIGN.width),
          minHeight: px(DESIGN.height),
          gap: px(24),
          paddingTop: px(24),
          paddingHorizontal: px(20),
          paddingBottom: px(40),
        },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ gap: px(12) }}>
        <Carousel model={model} px={px} direction={direction} onPrevious={previous} onNext={next} />
        <View style={{ gap: px(4) }}>
          <MarqueeTitle key={short.shortId} title={short.title} px={px} />
          <View style={[styles.row, { gap: px(8) }]}>
            <Touchable
              accessibilityRole="button"
              style={styles.shrink}
              onPress={() => act({ type: "abyss-profile", userId: short.author.userId })}
            >
              <Text
                allowFontScaling={false}
                numberOfLines={1}
                style={[text(px, 16, 22, "500"), styles.muted]}
              >
                {short.author.nickname}
              </Text>
            </Touchable>
            <View
              style={[styles.dot, { width: px(4), height: px(4), borderRadius: px(2) }]}
              accessibilityElementsHidden
              importantForAccessibility="no"
            />
            <Touchable
              accessibilityRole="button"
              onPress={() => act({ type: "abyss-participants" })}
            >
              <Text allowFontScaling={false} style={[text(px, 16, 22, "500"), styles.muted]}>
                작곡 참여자 보기
              </Text>
            </Touchable>
          </View>
        </View>
        <Reactions model={model} px={px} />
      </View>
      <View style={[styles.bottom, { gap: px(20) }]}>
        <View style={[styles.player, { gap: px(20) }]}>
          <Progress
            px={px}
            progressing={playback.progressing}
            positionMs={playback.positionMs}
            totalMs={playback.totalMs}
            onSeek={(ms) => act({ type: "abyss-seek", ms })}
          />
          <Controls
            px={px}
            playing={playback.playing}
            canPlay={playback.canPlay}
            canPrevious={model.canPrevious}
            canNext={model.canNext}
            onPrevious={previous}
            onToggle={() => act({ type: "abyss-toggle" })}
            onNext={next}
          />
          {model.messages.map((message, index) => (
            <Text
              key={index}
              allowFontScaling={false}
              accessibilityRole={message.alert ? "alert" : undefined}
              style={[text(px, 14, 14, "400"), styles.muted, styles.center]}
            >
              {message.text}
            </Text>
          ))}
          {model.nextFailed && (
            <Text
              allowFontScaling={false}
              accessibilityRole="alert"
              style={[text(px, 14, 14, "400"), styles.muted, styles.center]}
            >
              다음 숏폼을 불러오지 못했습니다.
              <Text
                accessibilityRole="button"
                disabled={!model.canNext}
                style={styles.retryLink}
                onPress={next}
              >
                {"  "}다시 시도
              </Text>
            </Text>
          )}
        </View>
        {model.feedback && (
          <View
            pointerEvents="none"
            style={[
              styles.feedback,
              {
                bottom: px(50),
                borderRadius: px(10),
                paddingVertical: px(6),
                paddingHorizontal: px(10),
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              accessibilityLiveRegion="polite"
              style={[text(px, 14, 18, "400"), styles.white, styles.center]}
            >
              {model.feedback}
            </Text>
          </View>
        )}
        <View
          style={[styles.joinSlot, { width: px(216), height: px(44) }]}
          accessibilityElementsHidden={!model.join}
          importantForAccessibility={model.join ? "auto" : "no-hide-descendants"}
        >
          {model.join && (
            <Touchable
              accessibilityRole="button"
              accessibilityState={{ disabled: model.join.busy }}
              disabled={model.join.busy}
              style={[
                styles.join,
                { width: px(216), height: px(44), borderRadius: px(37) },
                model.join.secondary && styles.joined,
              ]}
              onPress={() => act({ type: "abyss-join" })}
            >
              <Text
                allowFontScaling={false}
                style={[text(px, 16, 22, model.join.secondary ? "500" : "600"), styles.white]}
              >
                {model.join.label}
              </Text>
            </Touchable>
          )}
        </View>
      </View>
    </ScrollView>
  );
}

/**
 * The web AlbumCarousel: only the current cover shows; a horizontal drag pulls the track with
 * resistance and a 40px swipe moves on, the new cover sliding in from that side.
 */
function Carousel({
  model,
  px,
  direction,
  onPrevious,
  onNext,
}: {
  model: NativeAbyssReady;
  px: Px;
  direction: RefObject<"next" | "previous" | null>;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const shift = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const latest = useRef({ px, onPrevious, onNext });
  latest.current = { px, onPrevious, onNext };
  // The cover that was showing while the new one slides in, on the side it leaves to.
  const [shown, setShown] = useState<NativeAbyssCover>(model.short);
  const [leaving, setLeaving] = useState<{ cover: NativeAbyssCover; to: "left" | "right" } | null>(
    null,
  );
  if (shown.shortId !== model.short.shortId) {
    const moved =
      direction.current ??
      (model.previous?.shortId === shown.shortId
        ? "next"
        : model.next?.shortId === shown.shortId
          ? "previous"
          : null);
    direction.current = null;
    setLeaving(moved ? { cover: shown, to: moved === "next" ? "left" : "right" } : null);
    setShown(model.short);
  }
  useLayoutEffect(() => {
    if (!leaving) return;
    shift.stopAnimation();
    if (reduced) {
      shift.setValue(0);
      setLeaving(null);
      return;
    }
    shift.setValue(latest.current.px(leaving.to === "left" ? COVER.step : -COVER.step));
    Animated.timing(shift, { toValue: 0, useNativeDriver: true, ...SLIDE }).start(
      ({ finished }) => finished && setLeaving(null),
    );
  }, [leaving, reduced, shift]);

  const gesture = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, { dx, dy }) =>
          Math.abs(dx) >= 6 && Math.abs(dx) > Math.abs(dy),
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_, { dx }) => {
          const { px: scale } = latest.current;
          const distance = dx / scale(1);
          const offset =
            (Math.sign(distance) * 220 * Math.abs(distance)) / (220 + Math.abs(distance));
          shift.setValue(scale(offset));
        },
        onPanResponderRelease: (_, { dx, dy }) => {
          Animated.timing(shift, { toValue: 0, useNativeDriver: true, ...SLIDE }).start();
          if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.3) {
            if (dx < 0) latest.current.onNext();
            else latest.current.onPrevious();
          }
        },
        onPanResponderTerminate: () =>
          Animated.timing(shift, { toValue: 0, useNativeDriver: true, ...SLIDE }).start(),
      }),
    [shift],
  );

  const left = leaving?.to === "left" ? leaving.cover : model.previous;
  const right = leaving?.to === "right" ? leaving.cover : model.next;
  const size = px(COVER.size);
  const covers: [NativeAbyssCover | null, number][] = [
    [left, -1],
    [model.short, 0],
    [right, 1],
  ];
  return (
    <View
      style={[styles.carousel, { height: px(COVER.viewport) }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="숏폼 앨범"
      accessibilityValue={{ text: `${model.position} / ${model.count}, ${model.short.title}` }}
      accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
      onAccessibilityAction={(event) =>
        event.nativeEvent.actionName === "increment" ? onNext() : onPrevious()
      }
      {...gesture.panHandlers}
    >
      <Animated.View
        style={[
          styles.track,
          {
            top: px(COVER.top),
            left: px(COVER.left),
            width: size,
            height: size,
            transform: [{ translateX: shift }],
          },
        ]}
      >
        {covers.map(
          ([cover, slot]) =>
            cover && (
              <View key={slot} style={[styles.cover, { left: px(slot * COVER.step) }]}>
                <Cover
                  url={cover.albumImageUrl}
                  seed={`short:${cover.shortId}`}
                  size={size}
                  radius={px(16)}
                />
              </View>
            ),
        )}
      </Animated.View>
    </View>
  );
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => subscription.remove();
  }, []);
  return reduced;
}

/** The web title: one line that scrolls (12s loop, still for the first 12%) when it overflows. */
function MarqueeTitle({ title, px }: { title: string; px: Px }) {
  const [box, setBox] = useState(0);
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  const shift = useRef(new Animated.Value(0)).current;
  const overflows = box > 0 && width > box;
  const gap = px(32);
  useEffect(() => {
    shift.setValue(0);
    if (!overflows || reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1440),
        Animated.timing(shift, {
          toValue: -(width + gap),
          duration: 10560,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [overflows, reduced, width, gap, shift]);
  const style = [text(px, 20, 28, "700"), styles.white];
  return (
    <View
      style={styles.marquee}
      onLayout={(event) => setBox(event.nativeEvent.layout.width)}
      accessible
      accessibilityRole="header"
      accessibilityLabel={title}
    >
      {/* Natural width of the title, measured without the box's width limit. */}
      <View
        style={styles.measure}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
      >
        <Text
          allowFontScaling={false}
          style={style}
          onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
        >
          {title}
        </Text>
      </View>
      {overflows && !reduced ? (
        <Animated.View style={[styles.row, { transform: [{ translateX: shift }] }]}>
          <Text allowFontScaling={false} numberOfLines={1} style={[style, { width }]}>
            {title}
          </Text>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            style={[style, { width, marginLeft: gap }]}
          >
            {title}
          </Text>
        </Animated.View>
      ) : (
        <Text allowFontScaling={false} numberOfLines={1} style={style}>
          {title}
        </Text>
      )}
    </View>
  );
}

/** The web PostActions of the short: votes, comments, then share, save and report. */
function Reactions({ model, px }: { model: NativeAbyssReady; px: Px }) {
  const { act } = useScreen();
  const { short, busy } = model;
  const pill = { height: px(28), borderRadius: px(20) };
  const hitSlop = { top: px(6), bottom: px(6) };
  const count = [text(px, 14, 20, "500"), styles.white];
  return (
    <View style={[styles.row, { height: px(28), gap: px(6), marginTop: px(12) }]}>
      <View
        style={[styles.row, styles.surface, pill, { paddingHorizontal: px(10), gap: px(8) }]}
        accessibilityRole="toolbar"
        accessibilityLabel="반응"
      >
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`좋아요 ${short.likeCount}개`}
          accessibilityState={{ selected: short.vote === "like", disabled: busy }}
          disabled={busy}
          hitSlop={hitSlop}
          style={[styles.row, { height: px(28), gap: px(6) }]}
          onPress={() => act({ type: "abyss-vote", vote: "like" })}
        >
          <Icon px={px} icon={short.vote === "like" ? LikeOnIcon : LikeOffIcon} />
          <Text allowFontScaling={false} style={count}>
            {short.likeCount}
          </Text>
        </Touchable>
        <View style={[styles.divider, { width: px(1), height: px(16) }]} />
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`싫어요 ${short.dislikeCount}개`}
          accessibilityState={{ selected: short.vote === "dislike", disabled: busy }}
          disabled={busy}
          hitSlop={hitSlop}
          style={[styles.row, { height: px(28), gap: px(6) }]}
          onPress={() => act({ type: "abyss-vote", vote: "dislike" })}
        >
          <Icon px={px} icon={short.vote === "dislike" ? DislikeOnIcon : DislikeOffIcon} />
          <Text allowFontScaling={false} style={[count, styles.center, { minWidth: px(8) }]}>
            {short.dislikeCount}
          </Text>
        </Touchable>
      </View>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`댓글 ${short.commentCount}개 보기`}
        hitSlop={hitSlop}
        style={[
          styles.row,
          styles.surface,
          pill,
          { paddingHorizontal: px(10), paddingVertical: px(2), gap: px(6) },
        ]}
        onPress={() => act({ type: "abyss-comments" })}
      >
        <Icon px={px} icon={CommentIcon} />
        <Text allowFontScaling={false} style={count}>
          {short.commentCount}
        </Text>
      </Touchable>
      <View style={styles.root} />
      <Touchable
        accessibilityRole="button"
        accessibilityLabel="공유"
        hitSlop={hitSlop}
        style={[styles.iconButton, styles.surface, pill, { width: px(32) }]}
        onPress={() => act({ type: "abyss-share" })}
      >
        <Icon px={px} icon={ShareIcon} />
      </Touchable>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel="저장"
        accessibilityState={{ selected: short.saved, disabled: busy }}
        disabled={busy}
        hitSlop={hitSlop}
        style={[styles.iconButton, styles.surface, pill, { width: px(32) }]}
        onPress={() => act({ type: "abyss-save" })}
      >
        {short.saved ? (
          <SaveOnIcon width={px(14)} height={px(18)} />
        ) : (
          <SaveOffIcon width={px(14)} height={px(18)} />
        )}
      </Touchable>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel="신고"
        hitSlop={hitSlop}
        style={[styles.iconButton, styles.surface, pill, { width: px(32) }]}
        onPress={() => act({ type: "abyss-report" })}
      >
        <Icon px={px} icon={ReportIcon} />
      </Touchable>
    </View>
  );
}

/** An 18px icon slot holding the 17px icon, as the web's figma-icon-slot--post. */
function Icon({ px, icon: Glyph }: { px: Px; icon: FC<SvgProps> }) {
  return (
    <View style={[styles.slot, { width: px(18), height: px(18) }]}>
      <Glyph width={px(17)} height={px(17)} />
    </View>
  );
}

/** The web's range input: a 5px bar filled to the position and a 13px thumb. */
function Progress({
  px,
  progressing,
  positionMs,
  totalMs,
  onSeek,
}: {
  px: Px;
  progressing: boolean;
  positionMs: number;
  totalMs: number;
  onSeek: (ms: number) => void;
}) {
  const [width, setWidth] = useState(0);
  const [dragging, setDragging] = useState<number | null>(null);
  const latest = useRef({ width, totalMs, onSeek });
  latest.current = { width, totalMs, onSeek };
  const smoothMs = useSmoothPlaybackMs(
    positionMs,
    totalMs > 0 ? totalMs : null,
    progressing && dragging === null,
  );
  const fractionAt = (x: number) => Math.min(1, Math.max(0, x / (latest.current.width || 1)));
  const gesture = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => latest.current.totalMs > 0,
        onMoveShouldSetPanResponder: () => latest.current.totalMs > 0,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => setDragging(fractionAt(event.nativeEvent.locationX)),
        onPanResponderMove: (event) => setDragging(fractionAt(event.nativeEvent.locationX)),
        onPanResponderRelease: (event) => {
          const fraction = fractionAt(event.nativeEvent.locationX);
          setDragging(null);
          latest.current.onSeek(fraction * latest.current.totalMs);
        },
        onPanResponderTerminate: () => setDragging(null),
      }),
    [],
  );
  const fraction = dragging ?? (totalMs > 0 ? Math.min(1, smoothMs / totalMs) : 0);
  const thumb = px(13);
  const touch = px(12);
  return (
    <View
      style={[styles.progress, { height: px(5) + touch * 2, marginVertical: -touch }]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="재생 위치"
      accessibilityState={{ disabled: totalMs === 0 }}
      accessibilityValue={{
        min: 0,
        max: Math.round(totalMs / 1000),
        now: Math.round((fraction * totalMs) / 1000),
      }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      {...gesture.panHandlers}
    >
      <View
        pointerEvents="none"
        style={[styles.progressTrack, { top: touch, height: px(5), borderRadius: px(3) }]}
      >
        <View style={[styles.progressFill, { width: `${fraction * 100}%` }]} />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            top: touch + px(5) / 2 - thumb / 2,
            left: fraction * Math.max(0, width - thumb),
            width: thumb,
            height: thumb,
            borderRadius: thumb / 2,
          },
        ]}
      />
    </View>
  );
}

/** The web's 193×82 player asset with its previous, play/pause and next hit areas. */
function Controls({
  px,
  playing,
  canPlay,
  canPrevious,
  canNext,
  onPrevious,
  onToggle,
  onNext,
}: {
  px: Px;
  playing: boolean;
  canPlay: boolean;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onToggle: () => void;
  onNext: () => void;
}) {
  const side = { top: 0, width: px(30), height: px(82) };
  const slop = { left: px(7), right: px(7) };
  return (
    <View style={{ width: px(193), height: px(82) }}>
      <PlayerIcon width={px(193)} height={px(82)} />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="이전 숏폼"
        accessibilityState={{ disabled: !canPrevious }}
        disabled={!canPrevious}
        hitSlop={slop}
        style={[styles.absolute, side, { left: 0 }]}
        onPress={onPrevious}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={playing ? "일시정지" : "재생"}
        accessibilityState={{ disabled: !canPlay }}
        disabled={!canPlay}
        style={[
          styles.absolute,
          { top: 0, left: px(56), width: px(82), height: px(82), borderRadius: px(41) },
        ]}
        onPress={onToggle}
      >
        {playing && (
          <View style={[styles.pauseCover, { borderRadius: px(41) }]}>
            <View
              style={[
                styles.absolute,
                {
                  top: px(27),
                  left: px(31),
                  width: px(20),
                  height: px(28),
                  borderLeftWidth: px(7),
                  borderRightWidth: px(7),
                  borderColor: TOGGLE_INK,
                },
              ]}
            />
          </View>
        )}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="다음 숏폼"
        accessibilityState={{ disabled: !canNext }}
        disabled={!canNext}
        hitSlop={slop}
        style={[styles.absolute, side, { right: 0 }]}
        onPress={onNext}
      />
    </View>
  );
}

/** Pretendard text at design size; `allowFontScaling` stays off as on the web canvas. */
function text(
  px: Px,
  size: number,
  lineHeight: number,
  weight: TextStyle["fontWeight"],
): TextStyle {
  return {
    fontFamily,
    fontSize: px(size),
    lineHeight: px(lineHeight),
    fontWeight: weight,
    includeFontPadding: false,
  };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  view: { flexGrow: 1, alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center" },
  shrink: { flexShrink: 1, minWidth: 0 },
  center: { textAlign: "center" },
  muted: { color: colors.muted },
  white: { color: colors.fg },
  dot: { backgroundColor: colors.muted },
  surface: { backgroundColor: colors.surface },
  divider: { backgroundColor: "rgba(255, 255, 255, 0.25)" },
  iconButton: { alignItems: "center", justifyContent: "center" },
  slot: { alignItems: "center", justifyContent: "center" },
  state: { flex: 1, alignItems: "center", justifyContent: "center" },
  retry: { backgroundColor: colors.primary },
  retryLink: { color: colors.fg, textDecorationLine: "underline" },
  carousel: { alignSelf: "stretch", overflow: "hidden" },
  track: { position: "absolute", overflow: "visible" },
  cover: { position: "absolute", top: 0 },
  marquee: { alignSelf: "stretch", overflow: "hidden" },
  measure: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 10000,
    flexDirection: "row",
    opacity: 0,
  },
  bottom: { marginTop: "auto", alignSelf: "stretch" },
  player: { alignItems: "center", alignSelf: "stretch" },
  progress: { alignSelf: "stretch", justifyContent: "center" },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    overflow: "hidden",
    backgroundColor: PROGRESS.rest,
  },
  progressFill: { height: "100%", backgroundColor: PROGRESS.fill },
  thumb: { position: "absolute", backgroundColor: colors.fg },
  absolute: { position: "absolute" },
  pauseCover: { ...StyleSheet.absoluteFill, backgroundColor: "#ffffff" },
  feedback: { position: "absolute", left: 0, right: 0, backgroundColor: colors.surface },
  joinSlot: { alignSelf: "center" },
  join: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  joined: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
});
