import { useRef, useState, type ComponentRef } from "react";
import { ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import type {
  NativeSourceCard,
  NativeSourcePublications,
  NativeSourceRail,
  NativeSources,
} from "../../../src/lib/native-screens";
import { Cover } from "../../ui/cards";
import { Fab } from "../../ui/fab";
import { AppHeader } from "../../ui/header";
import { Button, ErrorRetry, Status, Tabs, Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { type } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { SavedSources } from "../workspace/library";
import { Card, Notice, Page, Pill } from "../workspace/parts";
import { Sheet } from "../profile/parts";
import { SourceActions, SourceAuthor, SourceLogin, SourcePlayer, styles } from "./parts";

const tabs: { value: NativeSources["tab"]; label: string }[] = [
  { value: "feed", label: "탐색" },
  { value: "saved", label: "보관함" },
  { value: "mine", label: "내 등록" },
];

export function SourcesScreen({ model, header }: ScreenProps<"sources">) {
  const { act } = useScreen();
  return (
    <>
      {header && <AppHeader header={header} onLogo={() => act({ type: "sources-home" })} />}
      <Tabs tabs={tabs} value={model.tab} onChange={(tab) => act({ type: "sources-tab", tab })} />
      <ScreenScroll fab={model.create}>
        {model.feed &&
          (model.feed.state === "signed-out" ? (
            <SourceLogin>샘플은 로그인 후 볼 수 있습니다.</SourceLogin>
          ) : (
            <View style={styles.column}>
              <Rail rail={model.feed.popular} section="popular" />
              <Rail rail={model.feed.recommended} section="recommended" />
              <View style={{ gap: 16 }}>
                <Text accessibilityRole="header" style={type.title}>
                  전체 샘플
                </Text>
                {model.feed.all.loading && <Status>샘플을 불러오는 중...</Status>}
                {model.feed.all.error && (
                  <ErrorRetry
                    message={model.feed.all.error}
                    onRetry={() => act({ type: "sources-rail-retry", rail: "recommended" })}
                  />
                )}
                {model.feed.all.empty && <Status>아직 공개된 샘플이 없습니다.</Status>}
                {model.feed.all.items.map((source) => (
                  <SourceCard key={source.key} source={source} />
                ))}
                {model.feed.all.more && (
                  <Button
                    tone="secondary"
                    label={model.feed.all.more.busy ? "불러오는 중..." : "더보기"}
                    disabled={model.feed.all.more.busy}
                    onPress={() => act({ type: "more" })}
                  />
                )}
              </View>
            </View>
          ))}
        {model.saved && (
          <Page title="샘플 보관함">
            <SavedSources saved={model.saved} />
          </Page>
        )}
        {model.mine && <Publications model={model.mine} />}
      </ScreenScroll>
      {model.create && <Fab label="만들기" onPress={() => act({ type: "sources-create" })} />}
    </>
  );
}

function Rail({ rail, section }: { rail: NativeSourceRail; section: "popular" | "recommended" }) {
  const { act } = useScreen();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const width = Math.max(1, useWindowDimensions().width - 40);
  const [page, setPage] = useState(0);
  const count = rail.items?.length ?? 0;
  const index = Math.max(0, Math.min(page, count - 1));
  return (
    <View style={{ gap: 12 }}>
      <View style={[styles.row, { justifyContent: "space-between" }]}>
        <Text accessibilityRole="header" style={type.title}>
          {rail.title}
        </Text>
        {count > 1 && (
          <View style={styles.row}>
            <Text style={type.caption}>
              {index + 1} / {count}
            </Text>
            <Pill
              label="‹"
              accessibilityLabel={`${rail.title} 이전 카드`}
              disabled={index === 0}
              onPress={() => scroll.current?.scrollTo({ x: (index - 1) * (width + 12) })}
            />
            <Pill
              label="›"
              accessibilityLabel={`${rail.title} 다음 카드`}
              disabled={index === count - 1}
              onPress={() => scroll.current?.scrollTo({ x: (index + 1) * (width + 12) })}
            />
          </View>
        )}
      </View>
      {!rail.items &&
        (rail.error ? (
          <ErrorRetry
            message={rail.error}
            onRetry={() => act({ type: "sources-rail-retry", rail: section })}
          />
        ) : (
          <Status>샘플을 불러오는 중...</Status>
        ))}
      {rail.items?.length === 0 && <Status>표시할 샘플이 없습니다.</Status>}
      {!!rail.items?.length && (
        <ScrollView
          ref={scroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={width + 12}
          decelerationRate="fast"
          contentContainerStyle={{ gap: 12 }}
          onScroll={({ nativeEvent }) =>
            setPage(Math.round(nativeEvent.contentOffset.x / (width + 12)))
          }
          scrollEventThrottle={100}
        >
          {rail.items.map((source) => (
            <View key={source.key} style={{ width }}>
              <SourceCard source={source} />
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

function SourceCard({ source }: { source: NativeSourceCard }) {
  const { act } = useScreen();
  const open = () => act({ type: "sources-open", openSourceId: source.openSourceId });
  return (
    <Card style={{ gap: 12 }}>
      <View style={styles.row}>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`${source.title} 보기`}
          style={[styles.row, { flex: 1 }]}
          onPress={open}
        >
          <Cover url={source.thumbnailUrl} size={44} />
          <View style={styles.title}>
            <Text style={type.title} numberOfLines={1}>
              {source.title}
            </Text>
            {source.usage && <Text style={type.caption}>{source.usage}</Text>}
          </View>
        </Touchable>
        <Pill
          primary
          label={source.saved ? "저장됨" : "저장"}
          pressed={source.saved}
          disabled={source.saveBusy}
          onPress={() => act({ type: "sources-save", key: source.key })}
        />
      </View>
      {source.saveError && (
        <Text accessibilityRole="alert" style={styles.error}>
          {source.saveError}
        </Text>
      )}
      <Touchable accessibilityRole="button" onPress={open}>
        {source.instrumentLabel && <Text style={styles.copy}>악기: {source.instrumentLabel}</Text>}
        <Text style={styles.copy}>{source.description}</Text>
      </Touchable>
      <SourcePlayer
        player={source.player}
        canPreview={source.canPreview}
        onToggle={() => act({ type: "sources-play", key: source.key })}
        onSeek={(ms) => act({ type: "sources-seek", key: source.key, ms })}
        onMute={() => act({ type: "sources-mute", key: source.key })}
      />
      <View style={[styles.row, { justifyContent: "space-between", flexWrap: "wrap" }]}>
        <SourceAuthor
          writer={source.writer}
          onPress={() => act({ type: "sources-profile", userId: source.writer.userId })}
        />
        <SourceActions
          source={source}
          onComments={() =>
            act({ type: "sources-open", openSourceId: source.openSourceId, comments: true })
          }
        />
      </View>
    </Card>
  );
}

function Publications({ model }: { model: NativeSourcePublications }) {
  const { act } = useScreen();
  if (model.state === "signed-out")
    return <SourceLogin>내 등록 샘플은 로그인 후 볼 수 있습니다.</SourceLogin>;
  if (model.state === "editor") return <PublicationEditor key={model.openSourceId} model={model} />;
  return (
    <Page title="내 등록 샘플">
      {model.notice && <Notice>{model.notice}</Notice>}
      {model.loading && <Status>내 등록 샘플을 불러오는 중...</Status>}
      {model.error && (
        <>
          <Notice alert>{model.error}</Notice>
          <Button
            tone="secondary"
            label="다시 시도"
            disabled={model.fetching || model.locked}
            onPress={() => act({ type: "sources-publications-page" })}
          />
        </>
      )}
      {model.empty && <Status>아직 등록한 샘플이 없습니다.</Status>}
      {model.items.map((source) => (
        <Card key={source.openSourceId} style={{ gap: 12 }}>
          <Text style={type.caption}>{source.public ? "공개" : "비공개"}</Text>
          <Text style={type.title}>{source.title}</Text>
          {source.instrumentLabel && <Text style={styles.copy}>악기: {source.instrumentLabel}</Text>}
          {source.description && <Text style={styles.copy}>{source.description}</Text>}
          <View style={[styles.row, { flexWrap: "wrap" }]}>
            <Pill
              label={source.managing ? "불러오는 중..." : "관리"}
              disabled={model.locked || model.fetching}
              onPress={() => act({ type: "sources-manage", openSourceId: source.openSourceId })}
            />
            <Pill
              label={source.switching ? "변경 중..." : source.public ? "비공개로 전환" : "공개하기"}
              disabled={model.locked || model.fetching}
              onPress={() => act({ type: "sources-visibility", openSourceId: source.openSourceId })}
            />
            {source.public && (
              <Pill
                primary
                label="자세히 보기"
                disabled={model.locked}
                onPress={() => act({ type: "sources-open", openSourceId: source.openSourceId })}
              />
            )}
          </View>
        </Card>
      ))}
      {model.more && (
        <Button
          tone="secondary"
          label={model.loading ? "불러오는 중..." : "더보기"}
          disabled={model.fetching || model.locked}
          onPress={() => act({ type: "sources-publications-page" })}
        />
      )}
    </Page>
  );
}

function PublicationEditor({
  model,
}: {
  model: Extract<NativeSourcePublications, { state: "editor" }>;
}) {
  const { act } = useScreen();
  const [title, setTitle] = useState(model.title);
  const [description, setDescription] = useState(model.description);
  return (
    <Page title="등록 관리">
      {model.notice && <Notice>{model.notice}</Notice>}
      <Card style={{ gap: 16 }}>
        <Text style={styles.copy}>
          공개 상태: {model.public ? "공개" : "비공개"}. 원본 음원은 변경되지 않습니다.
        </Text>
        <View style={styles.field}>
          <Text style={type.body}>제목</Text>
          <TextInput
            accessibilityLabel="제목"
            editable={!model.locked}
            style={styles.input}
            value={title}
            onChangeText={(value) => {
              setTitle(value);
              act({ type: "sources-editor-title", value });
            }}
          />
          <Text style={type.caption}>{Array.from(title.trim()).length}/100자 · 필수</Text>
        </View>
        <View style={styles.field}>
          <Text style={type.body}>설명 (선택)</Text>
          <TextInput
            accessibilityLabel="설명 (선택)"
            editable={!model.locked}
            multiline
            style={[styles.input, { minHeight: 100, textAlignVertical: "top" }]}
            value={description}
            onChangeText={(value) => {
              setDescription(value);
              act({ type: "sources-editor-description", value });
            }}
          />
          <Text style={type.caption}>{Array.from(description).length}/2000자</Text>
        </View>
        <Text style={type.body}>썸네일</Text>
        {(
          [
            ["keep", `현재 썸네일 유지${model.hasThumbnail ? "" : " (없음)"}`],
            ["replace", "새 이미지로 변경"],
            ["remove", "썸네일 삭제"],
          ] as const
        ).map(([thumbnail, label]) => (
          <Pill
            key={thumbnail}
            label={label}
            pressed={model.thumbnail === thumbnail}
            disabled={model.locked}
            onPress={() => act({ type: "sources-editor-thumbnail", thumbnail })}
          />
        ))}
        <Text style={type.caption}>새 썸네일 이미지 (JPG, PNG, WEBP, GIF · 최대 100MB)</Text>
        <Pill
          label="새 썸네일 이미지"
          disabled={model.locked}
          onPress={() => act({ type: "sources-editor-pick" })}
        />
        {model.fileName && <Text style={type.body}>선택한 이미지: {model.fileName}</Text>}
        {model.error && <Notice alert>{model.error}</Notice>}
        <Button
          label={model.saving ? "저장 중..." : "저장"}
          disabled={model.locked}
          onPress={() => act({ type: "sources-editor-save" })}
        />
        <Button
          tone="secondary"
          label="취소 / 목록으로"
          disabled={model.locked}
          onPress={() => act({ type: "sources-editor-close" })}
        />
        <Button
          tone="danger"
          label="샘플 삭제"
          disabled={model.locked}
          onPress={() => act({ type: "sources-delete-open" })}
        />
      </Card>
      {model.confirmDelete && (
        <Sheet
          title="샘플 삭제 확인"
          onClose={() => {
            if (!model.locked) act({ type: "sources-delete-cancel" });
          }}
        >
          <Text accessibilityRole="header" style={type.title}>
            샘플을 삭제할까요?
          </Text>
          <Text style={type.body}>
            “{model.confirmDelete.title}”을 삭제하면 되돌릴 수 없습니다.
          </Text>
          {model.confirmDelete.error && <Notice alert>{model.confirmDelete.error}</Notice>}
          <Button
            tone="secondary"
            label="취소"
            disabled={model.locked}
            onPress={() => act({ type: "sources-delete-cancel" })}
          />
          <Button
            tone="danger"
            label={
              model.deleting
                ? "삭제 중..."
                : model.confirmDelete.error
                  ? "삭제 다시 시도"
                  : "삭제 확인"
            }
            disabled={model.locked}
            onPress={() => act({ type: "sources-delete-confirm" })}
          />
        </Sheet>
      )}
    </Page>
  );
}
