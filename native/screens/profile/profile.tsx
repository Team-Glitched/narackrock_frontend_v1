import { useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import type {
  NativeProfile,
  NativeProfileList,
  NativeProfileListKind,
  NativeProfileSong,
  NativeProfileWorks,
} from "../../../src/lib/native-screens";
import { Cover, FeaturedCardStar, PersonRow, PostRow } from "../../ui/cards";
import { AppHeader } from "../../ui/header";
import { Avatar, Button, Status, Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { CenterMessage, FilterChip, styles as partStyles, Sheet } from "./parts";

/** The web profile (src/features/profile/profile-screens.tsx ProfileScreen). */
export function ProfileScreen({ model, header }: ScreenProps<"profile-view">) {
  const { act, uri } = useScreen();
  const { user } = model;
  return (
    <>
      {header && <AppHeader header={header} />}
      {!user ? (
        <CenterMessage tone={model.status === "error" ? "error" : "muted"}>
          {model.message}
        </CenterMessage>
      ) : (
        <ScreenScroll>
          <View style={styles.identity}>
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={model.own ? "프로필 편집" : "사용자 프로필 사진"}
              disabled={!model.own}
              onPress={() => act({ type: "edit" })}
            >
              <View style={styles.avatarRing}>
                <Avatar uri={uri(user.profileImageUrl)} size={136} />
              </View>
            </Touchable>
            <Text style={styles.nickname} accessibilityRole="header">
              {user.nickname}
            </Text>
            {model.relation && <Relation relation={model.relation} />}
            <View style={styles.stats}>
              <Stat kind="followers" label="팔로워" a11y="팔로워 목록" value={user.followers} />
              <Stat kind="following" label="팔로잉" a11y="팔로잉 목록" value={user.following} />
              <Stat kind="articles" label="게시글" a11y="작성한 게시글 목록" value={user.posts} />
            </View>
            {user.instruments.length > 0 && (
              <View style={styles.tags}>
                {user.instruments.map((instrument) => (
                  <Text key={instrument} style={styles.tag}>
                    {instrument}
                  </Text>
                ))}
              </View>
            )}
          </View>
          <View style={styles.sections}>
            <View style={styles.section}>
              <Text style={styles.heading} accessibilityRole="header">
                소개
              </Text>
              <Text
                style={
                  user.explanation && user.explanation !== "아직 소개가 없습니다."
                    ? styles.description
                    : styles.emptyText
                }
              >
                {user.explanation}
              </Text>
            </View>
            {model.featuredNotice && (
              <Text accessibilityRole="alert" style={styles.featuredNotice}>
                {model.featuredNotice}
              </Text>
            )}
            {model.sections.map((section) => (
              <Works key={section.key} works={section} starBusy={Boolean(model.starBusy)} />
            ))}
          </View>
        </ScreenScroll>
      )}
      {model.list && <ListSheet list={model.list} />}
    </>
  );
}

function Relation({ relation }: { relation: NonNullable<NativeProfile["relation"]> }) {
  const { act } = useScreen();
  return (
    <View style={styles.relation}>
      <View style={styles.relationButtons}>
        <Touchable
          accessibilityRole="button"
          accessibilityState={{
            disabled: relation.disabled,
            selected: relation.pressed ?? undefined,
          }}
          disabled={relation.disabled}
          style={[
            styles.relationButton,
            relation.tone === "secondary" && styles.relationSecondary,
            relation.disabled && styles.disabled,
          ]}
          onPress={() => act({ type: "follow" })}
        >
          <Text style={styles.relationText}>{relation.label}</Text>
        </Touchable>
        {relation.chat && (
          <Touchable
            accessibilityRole="button"
            style={[styles.relationButton, styles.relationSecondary]}
            onPress={() => act({ type: "profile-chat" })}
          >
            <Text style={styles.relationText}>채팅</Text>
          </Touchable>
        )}
      </View>
      {relation.checkError && (
        <View style={styles.checkError} accessibilityRole="alert">
          <Text style={styles.checkErrorText}>{relation.checkError}</Text>
          <Button
            label="다시 확인"
            tone="secondary"
            onPress={() => act({ type: "recheck-follow" })}
          />
        </View>
      )}
      {relation.notice && (
        <Text accessibilityRole="alert" style={[type.caption, styles.centerText]}>
          {relation.notice}
        </Text>
      )}
    </View>
  );
}

function Stat({
  kind,
  label,
  a11y,
  value,
}: {
  kind: NativeProfileListKind;
  label: string;
  a11y: string;
  value: string;
}) {
  const { act } = useScreen();
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={styles.stat}
      onPress={() => act({ type: "open-list", kind })}
    >
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </Touchable>
  );
}

function Works({ works, starBusy }: { works: NativeProfileWorks; starBusy: boolean }) {
  const { act } = useScreen();
  const [showAll, setShowAll] = useState(false);
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.heading, styles.flex]} numberOfLines={1} accessibilityRole="header">
          {works.title}
        </Text>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`${works.title} 모두보기`}
          hitSlop={8}
          onPress={() =>
            works.all === "sheet"
              ? setShowAll(true)
              : act({ type: "all-works", section: works.key })
          }
        >
          <Text style={styles.all}>모두보기</Text>
        </Touchable>
      </View>
      {showAll && (
        <Sheet title={`${works.title} 전체 목록`} onClose={() => setShowAll(false)}>
          <Text style={styles.sheetTitle} accessibilityRole="header">
            {works.title}
          </Text>
          {works.songs.length ? (
            <View style={styles.sheetList}>
              {works.songs.map((song) => (
                <Touchable
                  key={song.shortId}
                  accessibilityRole="button"
                  style={styles.sheetSong}
                  onPress={() => {
                    setShowAll(false);
                    act({ type: "open-short", shortId: song.shortId });
                  }}
                >
                  <Cover url={song.albumImageUrl} size={44} radius={6} />
                  <Text style={[type.label, styles.flex]} numberOfLines={1}>
                    {song.title}
                  </Text>
                </Touchable>
              ))}
            </View>
          ) : (
            <Status>아직 등록한 곡이 없습니다.</Status>
          )}
        </Sheet>
      )}
      {works.status === "loading" && (
        <Text accessibilityRole="text" style={styles.description}>
          음악을 불러오는 중...
        </Text>
      )}
      {works.status === "error" && (
        <View style={styles.workError} accessibilityRole="alert">
          <Text style={[styles.description, { color: colors.error }]}>{works.error}</Text>
          <Button label="다시 시도" tone="secondary" onPress={() => act({ type: "works-retry" })} />
        </View>
      )}
      {works.songs.length > 0 && (
        <FlatList
          horizontal
          data={works.songs}
          keyExtractor={(song) => String(song.shortId)}
          showsHorizontalScrollIndicator={false}
          style={styles.rail}
          contentContainerStyle={styles.railContent}
          renderItem={({ item }) => <SongCard song={item} starBusy={starBusy} />}
        />
      )}
      {works.status === "ready" && works.songs.length === 0 && works.emptyMessage !== "" && (
        <Text style={styles.emptyText}>{works.emptyMessage}</Text>
      )}
    </View>
  );
}

function SongCard({ song, starBusy }: { song: NativeProfileSong; starBusy: boolean }) {
  const { act } = useScreen();
  return (
    <View style={styles.songCard}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`${song.title} 열기`}
        style={styles.songCardBody}
        onPress={() => act({ type: "open-short", shortId: song.shortId })}
      >
        <Cover url={song.albumImageUrl} size={160} radius={10} />
        <Text style={styles.songTitle} numberOfLines={1}>
          {song.title}
        </Text>
      </Touchable>
      {song.star && (
        <FeaturedCardStar
          songTitle={song.title}
          pinned={song.star === "pinned"}
          busy={starBusy}
          onPress={() => act({ type: "toggle-featured", shortId: song.shortId })}
        />
      )}
    </View>
  );
}

/** Followers / following / posts (the web's ProfileListSheet); a song section's full list otherwise. */
function ListSheet({ list }: { list: NativeProfileList }) {
  const { act } = useScreen();
  return (
    <Sheet title={list.title} onClose={() => act({ type: "close-list" })}>
      <Text style={styles.sheetTitle} accessibilityRole="header">
        {list.title}
      </Text>
      {list.filter && (
        <View style={[partStyles.chipRow, styles.filter]} accessibilityLabel="팔로워 필터">
          <FilterChip
            label="전체"
            pressed={list.filter.value === "all"}
            onPress={() => act({ type: "list-filter", filter: "all" })}
          />
          <FilterChip
            label="맞팔로우"
            pressed={list.filter.value === "mutual"}
            disabled={list.filter.mutualDisabled}
            onPress={() => act({ type: "list-filter", filter: "mutual" })}
          />
        </View>
      )}
      {list.mutualChecking && <Status>맞팔로우 확인 중...</Status>}
      {list.mutualError && (
        <View style={styles.mutualError} accessibilityRole="alert">
          <Text style={[styles.description, styles.centerText]}>{list.mutualError}</Text>
          <Button
            label="다시 확인"
            tone="secondary"
            onPress={() => act({ type: "mutual-retry" })}
          />
        </View>
      )}
      {list.loading && <Status>불러오는 중...</Status>}
      {list.error && (
        <CenterMessage
          tone="error"
          action={
            list.retry ? (
              <Button
                label="다시 시도"
                tone="secondary"
                onPress={() => act({ type: "list-retry" })}
              />
            ) : undefined
          }
        >
          {list.error}
        </CenterMessage>
      )}
      <View style={styles.sheetList}>
        {list.kind === "articles"
          ? list.posts.map((post) => (
              <View key={post.postId} style={styles.unpad}>
                <PostRow
                  post={post}
                  onOpen={() => act({ type: "open-post", postId: post.postId })}
                />
              </View>
            ))
          : list.people.map((person) => (
              <View key={person.userId} style={styles.unpad}>
                <PersonRow
                  nickname={person.nickname}
                  profileImageUrl={person.profileImageUrl}
                  onOpen={() => act({ type: "open-profile", userId: person.userId })}
                  trailing={
                    person.instrument ? (
                      <Text style={type.caption} numberOfLines={1}>
                        {person.instrument}
                      </Text>
                    ) : undefined
                  }
                />
              </View>
            ))}
      </View>
      {list.emptyMessage && <Status>{list.emptyMessage}</Status>}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  disabled: { opacity: 0.5 },
  identity: { alignItems: "center", gap: 16, paddingHorizontal: gutter, paddingTop: 20 },
  avatarRing: { borderRadius: 70, overflow: "hidden" },
  nickname: {
    color: colors.fg,
    fontSize: 25,
    lineHeight: 32,
    fontWeight: "700",
    textAlign: "center",
  },
  relation: { alignSelf: "stretch", alignItems: "center", gap: 8, marginBottom: 16 },
  relationButtons: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  relationButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  relationSecondary: { backgroundColor: colors.surface },
  relationText: { color: colors.fg, fontSize: 15, fontWeight: "600" },
  checkError: {
    alignSelf: "stretch",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.panel,
  },
  checkErrorText: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: "center" },
  centerText: { textAlign: "center" },
  stats: { flexDirection: "row", alignSelf: "stretch" },
  stat: { flex: 1, alignItems: "center", paddingVertical: 4 },
  statLabel: { color: colors.fg, fontSize: 12, lineHeight: 16 },
  statValue: { color: colors.muted, fontSize: 16, lineHeight: 22, fontWeight: "600" },
  tags: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 },
  tag: {
    height: 24,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 13,
    overflow: "hidden",
    color: colors.fg,
    fontSize: 12,
    lineHeight: 18,
    backgroundColor: colors.primary,
  },
  sections: { marginTop: 32, gap: 32, paddingHorizontal: gutter },
  section: { gap: 12 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  heading: {
    color: colors.fg,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  all: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: "500" },
  description: { color: colors.muted, fontSize: 14, lineHeight: 22, paddingVertical: 4 },
  emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, paddingVertical: 16 },
  workError: { alignItems: "center", gap: 16, paddingHorizontal: 16, paddingVertical: 32 },
  rail: { marginHorizontal: -gutter },
  railContent: { paddingHorizontal: gutter, gap: 20, paddingBottom: 4 },
  songCard: { width: 160, gap: 10 },
  songCardBody: { gap: 10 },
  featuredNotice: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.error,
    fontSize: 14,
    lineHeight: 20,
  },
  songTitle: { color: colors.fg, fontSize: 16, lineHeight: 20, fontWeight: "700" },
  sheetTitle: {
    color: colors.fg,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "600",
    marginBottom: 24,
  },
  filter: { marginBottom: 16 },
  sheetSong: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 10 },
  mutualError: {
    alignItems: "center",
    gap: 12,
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sheetList: { gap: 20 },
  unpad: { marginHorizontal: -gutter },
});
