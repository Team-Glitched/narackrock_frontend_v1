import { useRef } from "react";
import { FlatList, StyleSheet, Text, View, type ScrollViewInstance } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";

import type { NativeHome, NativeWork } from "../../src/lib/native-screens";
import { postStatus, PostRow, SongRail } from "../ui/cards";
import { AppHeader } from "../ui/header";
import { Button, Section, Status, Touchable } from "../ui/kit";
import { ScreenScroll } from "../ui/screen";
import { useScreen } from "../ui/screen-context";
import { colors, gutter, type } from "../ui/theme";
import type { ScreenProps } from "./types";

/** The web home (src/features/home/home-screens.tsx). */
export function HomeScreen({ model: home, header }: ScreenProps<"home">) {
  const { act } = useScreen();
  const scroll = useRef<ScrollViewInstance>(null);
  const open = (shortId: number) => act({ type: "open-short", shortId });
  return (
    <>
      {header && (
        <AppHeader
          header={header}
          onLogo={() => scroll.current?.scrollTo({ y: 0, animated: true })}
        />
      )}
      <ScreenScroll scrollRef={scroll}>
        {home.works && <WorksSection works={home.works} />}
        <Section title="인기 차트" onAll={() => act({ type: "show-songs", kind: "popular" })}>
          <SongRail list={home.popular} onOpen={open} menu />
        </Section>
        <Section title="추천" onAll={() => act({ type: "show-songs", kind: "recommended" })}>
          <SongRail list={home.recommended} onOpen={open} menu />
        </Section>
        <Section title="인기 게시글" onAll={() => act({ type: "open-posts" })}>
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
                  onOpen={() => act({ type: "open-post", postId: post.postId })}
                />
              ))}
            </View>
          )}
        </Section>
        {home.mine && (
          <Section title="내 음악" onAll={() => act({ type: "show-songs", kind: "mine" })}>
            <SongRail list={home.mine} onOpen={open} />
          </Section>
        )}
      </ScreenScroll>
    </>
  );
}

function WorksSection({ works }: { works: NonNullable<NativeHome["works"]> }) {
  const { act } = useScreen();
  const hasItems = works.items.length > 0;
  return (
    <Section
      title="이 기기에서 연 작업"
      onAll={hasItems ? () => act({ type: "open-workspace" }) : undefined}
    >
      {works.error && <Status tone="error">{works.error}</Status>}
      {works.loading && <Status>방문한 작업을 불러오는 중입니다.</Status>}
      {hasItems ? (
        <FlatList
          horizontal
          data={works.items}
          keyExtractor={(work) => String(work.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.works}
          renderItem={({ item }) => <WorkCard work={item} />}
        />
      ) : (
        !works.loading &&
        !works.error && (
          <View style={styles.worksEmpty}>
            <Text style={type.muted}>새 곡을 만들거나 음악에 참여해 보세요.</Text>
            <Button label="작곡 시작하기" onPress={() => act({ type: "start-song" })} />
          </View>
        )
      )}
    </Section>
  );
}

function WorkCard({ work }: { work: NativeWork }) {
  const { act } = useScreen();
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={`${work.title} 이어서 작곡하기`}
      style={styles.workCard}
      onPress={() => act({ type: "resume", projectId: work.id, shortId: work.shortId })}
    >
      <View style={styles.workTop}>
        <Text style={type.caption}>{work.visitedLabel ?? "작업 중"}</Text>
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
        <Text style={type.label} numberOfLines={1}>
          {work.title}
        </Text>
        <Text style={type.muted}>
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

const styles = StyleSheet.create({
  posts: { gap: 12 },
  works: { paddingHorizontal: gutter, gap: 12 },
  worksEmpty: {
    marginHorizontal: gutter,
    padding: 20,
    gap: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
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
});
