import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import SearchIcon from "../../../public/figma/search-input.svg";
import type {
  NativeLibrary,
  NativePlayback,
  NativePlaybackTarget,
} from "../../../src/lib/native-screens";
import { Cover } from "../../ui/cards";
import { AppHeader } from "../../ui/header";
import { Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors } from "../../ui/theme";
import { SEARCH_QUERY_MAX_LENGTH, clampCodePoints } from "../../../src/lib/content-limits";
import type { ScreenProps } from "../types";
import { Card, Empty, Notice, Page, Pill, styles as parts, text, Wide } from "./parts";
import { PlaybackBar } from "./playback-bar";

const filters: { value: "SERVER" | "LOCAL"; label: string }[] = [
  { value: "SERVER", label: "보관한 샘플" },
  { value: "LOCAL", label: "이 기기의 MIDI 작업" },
];

/** The web's sample library (src/features/workspace/workspace-screens.tsx SourceLibraryScreen). */
export function WorkspaceLibraryScreen({ model, header }: ScreenProps<"workspace-library">) {
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenScroll>
        {model.view === "pick-work" ? <PickWork model={model} /> : <Library model={model} />}
      </ScreenScroll>
    </>
  );
}

function PickWork({ model }: { model: Extract<NativeLibrary, { view: "pick-work" }> }) {
  const { act } = useScreen();
  return (
    <Page title="사용할 곡 선택" subtitle={model.subtitle}>
      <Wide label="리소스 목록으로 돌아가기" onPress={() => act({ type: "cancel-pick" })} />
      {model.error && <Notice alert>{model.error}</Notice>}
      {model.loading && <Empty>작업을 불러오는 중입니다.</Empty>}
      {model.empty && <Empty>{model.empty}</Empty>}
      {model.works.map((work) => (
        <Touchable
          key={work.id}
          accessibilityRole="button"
          accessibilityState={{ disabled: model.busy }}
          disabled={model.busy}
          onPress={() => act({ type: "pick", workId: work.id })}
        >
          <Card style={model.busy && parts.disabled}>
            <Text style={[text.labelStrong, styles.cardTitle]}>{work.title}</Text>
            <Text style={text.bodyMuted}>{work.meta}</Text>
            <Text style={[text.caption, styles.cardLink]}>이 곡에 추가 →</Text>
          </Card>
        </Touchable>
      ))}
      {model.paging && (
        <Wide label="더보기" disabled={model.paging.busy} onPress={() => act({ type: "more" })} />
      )}
      {model.notice && <Text style={text.label}>{model.notice}</Text>}
      <Wide label="새 곡 만들기" onPress={() => act({ type: "start-song" })} />
    </Page>
  );
}

function Library({ model }: { model: Extract<NativeLibrary, { view: "library" }> }) {
  const { act } = useScreen();
  return (
    <Page title={model.title} subtitle={model.subtitle}>
      <SearchField query={model.query} />
      <View style={styles.tabs}>
        {(model.importing ? filters.filter((f) => f.value === "LOCAL") : filters).map((filter) => {
          const selected = model.filter === filter.value;
          return (
            <Touchable
              key={filter.value}
              accessibilityRole="button"
              accessibilityState={{ checked: selected }}
              style={[styles.tab, selected && styles.tabSelected]}
              onPress={() => act({ type: "filter", filter: filter.value })}
            >
              <Text style={[styles.tabText, selected && styles.tabTextSelected]}>
                {filter.label}
              </Text>
            </Touchable>
          );
        })}
      </View>
      {model.notice && <Notice>{model.notice}</Notice>}
      {model.local && (
        <>
          {model.local.empty && <Empty>{model.local.empty}</Empty>}
          {model.local.items.map((resource) => (
            <Card key={resource.id} style={styles.libraryCard}>
              <Text style={text.bodyMuted}>이 기기에 저장된 MIDI 작업</Text>
              <Text style={[text.labelStrong, styles.cardTitle]}>{resource.title}</Text>
              <Text style={text.bodyMuted}>{resource.description}</Text>
              {resource.player && (
                <Player player={resource.player} target={{ kind: "local", id: resource.id }} />
              )}
              <View style={parts.actions}>
                <Pill
                  label={resource.saved ? "로컬 즐겨찾기됨" : "로컬 즐겨찾기"}
                  pressed={resource.saved}
                  onPress={() => act({ type: "toggle-favorite", id: resource.id })}
                />
                <Pill
                  label={
                    model.busyId === resource.id
                      ? "가져오는 중…"
                      : model.importing
                        ? "개인 초안으로 가져오기"
                        : "선택한 곡의 개인 초안으로"
                  }
                  primary
                  disabled={model.busyId !== null}
                  onPress={() => act({ type: "use", id: resource.id })}
                />
              </View>
            </Card>
          ))}
        </>
      )}
      {model.saved && <SavedSources saved={model.saved} />}
      {!model.importing && (
        <Wide label="샘플 둘러보기" onPress={() => act({ type: "open-sources" })} />
      )}
    </Page>
  );
}

/** Text stays here; the page filters a moment after typing stops. */
function SearchField({ query }: { query: string }) {
  const { act } = useScreen();
  const [value, setValue] = useState(query);
  useEffect(() => {
    if (value === query) return;
    const timer = setTimeout(() => act({ type: "query", value }), 250);
    return () => clearTimeout(timer);
  }, [act, query, value]);
  return (
    <View style={styles.search}>
      <SearchIcon width={18} height={18} />
      <TextInput
        accessibilityLabel="보관함 검색"
        placeholder="리소스 검색"
        placeholderTextColor="#9692a6"
        selectionColor={colors.accent}
        value={value}
        onChangeText={(text) => setValue(clampCodePoints(text, SEARCH_QUERY_MAX_LENGTH))}
        returnKeyType="search"
        style={styles.searchInput}
      />
    </View>
  );
}

/** The account's saved samples (the web's SavedOpenSources); also drawn by /sources?tab=saved. */
export function SavedSources({
  saved,
}: {
  saved: NonNullable<Extract<NativeLibrary, { view: "library" }>["saved"]>;
}) {
  const { act } = useScreen();
  if (saved.state === "signed-out")
    return (
      <Empty action={<Pill label="로그인" primary onPress={() => act({ type: "sign-in" })} />}>
        저장한 샘플은 로그인 후 볼 수 있습니다.
      </Empty>
    );
  if (saved.state === "loading") return <Empty>저장한 샘플을 불러오는 중...</Empty>;
  return (
    <>
      {saved.notice && <Notice alert>{saved.notice}</Notice>}
      {saved.empty && <Empty>{saved.empty}</Empty>}
      {saved.items.map((item) => (
        <Card key={item.openSourceId} style={styles.libraryCard}>
          {item.source ? (
            <>
              <View style={styles.savedHead}>
                <Cover
                  url={item.source.thumbnailUrl}
                  seed={`source:${item.openSourceId}`}
                  size={48}
                  radius={8}
                />
                <View style={styles.savedMeta}>
                  <Text style={[text.labelStrong, styles.savedTitle]} numberOfLines={1}>
                    {item.source.title}
                  </Text>
                  <Text style={text.bodyMuted} numberOfLines={1}>
                    {item.source.writer}
                  </Text>
                </View>
              </View>
              {item.source.description && (
                <Text style={text.bodyMuted}>{item.source.description}</Text>
              )}
              {!item.source.canPreview ? (
                <Text style={[text.caption, styles.audioNote]}>
                  이 샘플은 현재 미리듣기를 사용할 수 없습니다.
                </Text>
              ) : (
                item.source.player && (
                  <Player
                    player={item.source.player}
                    target={{ kind: "saved", id: item.openSourceId }}
                  />
                )
              )}
              <Text style={styles.hint}>
                보관한 뒤 스튜디오의 ‘+ 샘플’에서 레이어에 추가할 수 있습니다. MIDI 샘플은 피아노롤에서도 음표로 불러올 수 있습니다.
              </Text>
            </>
          ) : (
            <>
              <Text style={[text.labelStrong, styles.savedTitle]}>사용할 수 없는 샘플</Text>
              <Text style={text.bodyMuted}>
                삭제되었거나 비공개로 전환되어 재생하거나 곡에 넣을 수 없습니다.
              </Text>
            </>
          )}
          <View style={[parts.actions, styles.savedActions]}>
            <Pill
              label={saved.unsavingId === item.openSourceId ? "해제 중..." : "저장 해제"}
              disabled={saved.locked}
              onPress={() => act({ type: "unsave", openSourceId: item.openSourceId })}
            />
            {item.source && (
              <Pill
                label="자세히 보기"
                primary
                onPress={() => act({ type: "open-source", openSourceId: item.openSourceId })}
              />
            )}
          </View>
        </Card>
      ))}
      {saved.error && <Notice alert>{saved.error}</Notice>}
      {saved.paging && (
        <Wide
          label={saved.paging.label}
          disabled={saved.paging.busy}
          onPress={() => act({ type: "more" })}
        />
      )}
    </>
  );
}

/** A preview's play bar and its error; sends play/seek/mute for `target`. */
export function Player({
  player,
  target,
}: {
  player: NativePlayback;
  target: NativePlaybackTarget;
}) {
  const { act } = useScreen();
  return (
    <View style={styles.player}>
      <PlaybackBar
        player={player}
        onToggle={() => act({ type: "play", target })}
        onSeek={(ms) => act({ type: "seek", target, ms })}
        onMute={() => act({ type: "mute", target })}
      />
      {player.error && <Text style={[text.caption, styles.audioNote]}>{player.error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 24,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, minWidth: 0, color: colors.fg, fontSize: 16, padding: 0 },
  tabs: { flexDirection: "row", gap: 8, paddingVertical: 4 },
  tab: {
    minHeight: 28,
    justifyContent: "center",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  tabSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  tabText: { color: colors.muted, fontSize: 14, lineHeight: 18, fontWeight: "500" },
  tabTextSelected: { color: colors.fg },
  libraryCard: { gap: 10 },
  savedHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  savedMeta: { flex: 1, minWidth: 0, gap: 2 },
  cardTitle: { marginVertical: 6 },
  cardLink: { marginTop: 12 },
  savedTitle: { lineHeight: 24, fontWeight: "700" },
  hint: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  audioNote: { marginVertical: 12 },
  player: { marginVertical: 12 },
  savedActions: { marginTop: 4, gap: 8 },
});
