import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import BackIcon from "../../public/figma/return.svg";
import type { NativeSearch, NativeSearchScope } from "../../src/lib/native-screens";
import { MediaRow, PersonRow, PostRow, SongRow } from "../ui/cards";
import { CommunityCard } from "../ui/community";
import { Button, ErrorRetry, Status, Tabs, Touchable } from "../ui/kit";
import { ScreenList } from "../ui/screen";
import { useScreen } from "../ui/screen-context";
import { SearchPill } from "../ui/search-pill";
import { colors, gutter, type } from "../ui/theme";
import type { ScreenProps } from "./types";

const scopes: { value: NativeSearchScope; label: string }[] = [
  { value: "sources", label: "샘플" },
  { value: "songs", label: "음악" },
  { value: "people", label: "사용자" },
  { value: "posts", label: "게시글" },
  { value: "communities", label: "커뮤니티" },
];

type Row =
  | { key: string; kind: "post"; item: NonNullable<NativeSearch["results"]>["posts"][number] }
  | {
      key: string;
      kind: "community";
      item: NonNullable<NativeSearch["results"]>["communities"][number];
    }
  | { key: string; kind: "song"; item: NonNullable<NativeSearch["results"]>["songs"][number] }
  | { key: string; kind: "source"; item: NonNullable<NativeSearch["results"]>["sources"][number] }
  | { key: string; kind: "person"; item: NonNullable<NativeSearch["results"]>["people"][number] };

function rows(search: NativeSearch): Row[] {
  const results = search.results;
  if (!results) return [];
  switch (search.scope) {
    case "posts":
      return results.posts.map((item) => ({ key: `p${item.postId}`, kind: "post", item }));
    case "communities":
      return results.communities.map((item) => ({
        key: `c${item.galleryId}`,
        kind: "community",
        item,
      }));
    case "songs":
      return results.songs.map((item) => ({ key: `s${item.shortId}`, kind: "song", item }));
    case "sources":
      return results.sources.map((item) => ({
        key: `o${item.openSourceId}`,
        kind: "source",
        item,
      }));
    case "people":
      return results.people.map((item) => ({ key: `u${item.userId}`, kind: "person", item }));
  }
}

/** The web search page (src/features/search/search-screen.tsx ScopedSearch). */
export function SearchScreen({ model: search }: ScreenProps<"search">) {
  const { act } = useScreen();
  return (
    <>
      <SearchLine search={search} />
      {search.community ? (
        <Text style={[type.muted, styles.context]}>{search.community} 내 게시글</Text>
      ) : (
        <Tabs
          tabs={scopes}
          value={search.scope}
          onChange={(scope) => act({ type: "scope", scope })}
        />
      )}
      <ScreenList
        data={rows(search)}
        keyExtractor={(row) => row.key}
        hasMore={search.paging !== null}
        busy={search.paging?.busy || search.paging?.failed}
        contentContainerStyle={styles.list}
        ListHeaderComponent={<Message search={search} />}
        ListEmptyComponent={search.empty ? <Status>검색 결과가 없습니다.</Status> : undefined}
        renderItem={({ item: row }) => {
          switch (row.kind) {
            case "post":
              return (
                <PostRow
                  post={row.item}
                  onOpen={() => act({ type: "open-post", postId: row.item.postId })}
                />
              );
            case "community":
              return (
                <CommunityCard
                  community={row.item}
                  onOpen={() => act({ type: "open-community", galleryId: row.item.galleryId })}
                  onToggleJoin={() => act({ type: "toggle-join", galleryId: row.item.galleryId })}
                />
              );
            case "song":
              return (
                <SongRow
                  song={row.item}
                  onOpen={() => act({ type: "open-short", shortId: row.item.shortId })}
                />
              );
            case "source":
              return (
                <MediaRow
                  title={row.item.title}
                  subtitle={row.item.author}
                  coverUrl={row.item.thumbnailUrl}
                  seed={`source:${row.item.openSourceId}`}
                  onOpen={() => act({ type: "open-source", openSourceId: row.item.openSourceId })}
                />
              );
            case "person":
              return (
                <PersonRow
                  nickname={row.item.nickname}
                  profileImageUrl={row.item.profileImageUrl}
                  onOpen={() => act({ type: "open-profile", userId: row.item.userId })}
                />
              );
          }
        }}
        ListFooterComponent={
          search.paging ? (
            <View style={styles.paging}>
              {search.paging.failed && (
                <Text accessibilityRole="alert" style={[type.body, { color: colors.error }]}>
                  검색 결과를 불러오지 못했습니다.
                </Text>
              )}
              <Button
                label={
                  search.paging.busy ? "검색 중..." : search.paging.failed ? "다시 시도" : "더보기"
                }
                tone="secondary"
                busy={search.paging.busy}
                onPress={() => act({ type: "more" })}
              />
            </View>
          ) : undefined
        }
      />
    </>
  );
}

/** Back button and the search field; typing is sent to the page after a short pause, as on the web. */
function SearchLine({ search }: { search: NativeSearch }) {
  const { act } = useScreen();
  const [text, setText] = useState(search.query);
  // The page's query changes only through this field (or a new search page), so follow it when it
  // differs from what was last sent.
  const sent = useRef(search.query);
  useEffect(() => {
    if (search.query !== sent.current) {
      sent.current = search.query;
      setText(search.query);
    }
  }, [search.query]);
  useEffect(() => {
    if (text === sent.current) return;
    const timer = setTimeout(() => {
      sent.current = text;
      act({ type: "query", value: text });
    }, 150);
    return () => clearTimeout(timer);
  }, [text, act]);
  return (
    <View style={styles.line}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel="돌아가기"
        style={styles.back}
        onPress={() => act({ type: "back" })}
      >
        <BackIcon width={22} height={22} />
      </Touchable>
      <SearchPill
        autoFocus
        value={text}
        onChangeText={setText}
        onClear={() => {
          setText("");
          sent.current = "";
          act({ type: "query", value: "" });
        }}
        clearLabel="검색어 지우기"
        placeholder={search.placeholder}
        returnKeyType="search"
        accessibilityLabel={
          search.community ? `${search.community} 내부 게시글 검색` : search.placeholder
        }
        style={styles.field}
      />
    </View>
  );
}

function Message({ search }: { search: NativeSearch }) {
  const { act } = useScreen();
  const { message } = search;
  if (message?.signIn)
    return (
      <View style={styles.signIn}>
        <Text style={[type.muted, styles.center]}>{message.text}</Text>
        <Button label="로그인" onPress={() => act({ type: "sign-in" })} />
      </View>
    );
  if (message?.tone === "error")
    return <ErrorRetry message={message.text} onRetry={() => act({ type: "retry" })} />;
  if (message) return <Status>{message.text}</Status>;
  if (search.searching) return <Status>검색 중...</Status>;
  return null;
}

const styles = StyleSheet.create({
  line: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 8,
    paddingRight: gutter,
    paddingVertical: 8,
  },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  field: { flex: 1 },
  context: { paddingHorizontal: gutter, paddingBottom: 8 },
  list: { gap: 12 },
  signIn: { gap: 16, padding: gutter, alignItems: "stretch" },
  center: { textAlign: "center" },
  paging: { gap: 8, paddingHorizontal: gutter, paddingTop: 8 },
});
