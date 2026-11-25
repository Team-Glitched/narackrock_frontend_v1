import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import type {
  NativeSourceCard,
  NativeSourcePublications,
  NativeSourceSection,
  NativeSources,
} from "../../../src/lib/native-screens";
import { Cover } from "../../ui/cards";
import { Fab } from "../../ui/fab";
import { AppHeader } from "../../ui/header";
import { Button, ErrorRetry, Status, Tabs, Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { gutter, type } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { SavedSources } from "../workspace/library";
import { Card, Notice, Page, Pill } from "../workspace/parts";
import { Sheet } from "../profile/parts";
import { SourceAuthor, SourceLogin, SourcePlayer, SourceStats, styles } from "./parts";
import {
  SOURCE_DESCRIPTION_MAX_LENGTH,
  SOURCE_TITLE_MAX_LENGTH,
  clampCodePoints,
  codePointLength,
} from "../../../src/lib/content-limits";

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
              <SourceSection section={model.feed.popular} kind="popular" />
              <SourceSection section={model.feed.recommended} kind="recommended" />
              <SourceSection
                section={{
                  title: "전체 샘플",
                  items: model.feed.all.loading || model.feed.all.error ? null : model.feed.all.items,
                  error: model.feed.all.error,
                }}
                kind="recommended"
                emptyMessage="아직 공개된 샘플이 없습니다."
                more={model.feed.all.more}
                onMore={() => act({ type: "more" })}
              />
            </View>
          ))}
        {model.saved && (
          <Page title="샘플 보관함">
            <SavedSources saved={model.saved} />
          </Page>
        )}
        {model.mine && <Publications model={model.mine} />}
      </ScreenScroll>
      {model.create && (
        <Fab
          label="만들기"
          accessibilityLabel="만들기: 샘플 생성"
          onPress={() => act({ type: "sources-create" })}
        />
      )}
    </>
  );
}

function SourceSection({
  section,
  kind,
  emptyMessage = "표시할 샘플이 없습니다.",
  more = null,
  onMore,
}: {
  section: NativeSourceSection;
  kind: "popular" | "recommended";
  emptyMessage?: string;
  more?: { busy: boolean; error: string | null } | null;
  onMore?: () => void;
}) {
  const { act } = useScreen();
  // The rail's own width inside the screen padding and safe area; cards render once it is measured.
  const [innerWidth, setInnerWidth] = useState(0);
  const count = section.items?.length ?? 0;
  const paged = count > 1 || Boolean(more && onMore);
  const cardWidth = paged ? Math.max(240, innerWidth - 16) : innerWidth;
  // Room after the last card so it can reach its start snap like the others.
  const endSpace = count > 1 ? Math.max(0, innerWidth - cardWidth) : 0;
  return (
    <View
      style={{ gap: 12 }}
      onLayout={(event) => setInnerWidth(event.nativeEvent.layout.width)}
    >
      <Text accessibilityRole="header" style={type.title}>
        {section.title}
      </Text>
      {!section.items &&
        (section.error ? (
          <ErrorRetry
            message={section.error}
            onRetry={() => act({ type: "sources-section-retry", section: kind })}
          />
        ) : (
          <Status>샘플을 불러오는 중...</Status>
        ))}
      {section.items?.length === 0 && <Status>{emptyMessage}</Status>}
      {!!section.items?.length && innerWidth > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={cardWidth + 16}
          snapToAlignment="start"
          decelerationRate="fast"
          disableIntervalMomentum
          scrollEventThrottle={120}
          onScroll={(event) => {
            if (!more || more.busy || more.error || !onMore) return;
            const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
            if (
              contentOffset.x + layoutMeasurement.width >=
              contentSize.width - (cardWidth + 16) * 1.5
            ) {
              onMore();
            }
          }}
          style={{ marginHorizontal: -gutter }}
          contentContainerStyle={{
            paddingLeft: gutter,
            paddingRight: gutter + endSpace,
            gap: 16,
          }}
        >
          {section.items.map((source) => (
            <View key={source.key} style={{ width: cardWidth }}>
              <SourceCard source={source} />
            </View>
          ))}
          {more &&
            onMore &&
            (more.error && !more.busy ? (
              <View style={{ width: 200, justifyContent: "center" }}>
                <ErrorRetry message={more.error} onRetry={onMore} />
              </View>
            ) : (
              <View style={{ width: 124, justifyContent: "center" }}>
                <Button
                  tone="secondary"
                  label={more.busy ? "불러오는 중..." : "더보기"}
                  disabled={more.busy}
                  onPress={onMore}
                />
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
          <Cover url={source.thumbnailUrl} seed={`source:${source.openSourceId}`} size={44} />
          <View style={styles.title}>
            <Text style={type.label} numberOfLines={1}>
              {source.title}
            </Text>
            {source.instrumentLabel && (
              <Text style={type.caption}>악기: {source.instrumentLabel}</Text>
            )}
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
        <SourceStats source={source} />
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
          <Text style={type.label}>{source.title}</Text>
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
        {model.instrumentLabel && <Text style={styles.copy}>악기: {model.instrumentLabel}</Text>}
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
              const clamped = clampCodePoints(value, SOURCE_TITLE_MAX_LENGTH);
              setTitle(clamped);
              act({ type: "sources-editor-title", value: clamped });
            }}
          />
          <Text style={type.caption}>
            {codePointLength(title.trim())}/{SOURCE_TITLE_MAX_LENGTH}자 · 필수
          </Text>
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
              const clamped = clampCodePoints(value, SOURCE_DESCRIPTION_MAX_LENGTH);
              setDescription(clamped);
              act({ type: "sources-editor-description", value: clamped });
            }}
          />
          <Text style={type.caption}>
            {codePointLength(description)}/{SOURCE_DESCRIPTION_MAX_LENGTH}자
          </Text>
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
