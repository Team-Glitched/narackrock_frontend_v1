import { StyleSheet, Text, View } from "react-native";

import { AppHeader } from "../../ui/header";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import type { ScreenProps } from "../types";
import { Card, Empty, Notice, Page, Pill, text, Wide, WorkPreview } from "./parts";

/** The web's visited works page (src/features/workspace/workspace-screens.tsx WorkspaceScreen). */
export function WorkspaceWorksScreen({ model, header }: ScreenProps<"workspace-works">) {
  const { act } = useScreen();
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenScroll>
        <Page
          title="이 기기에서 연 작업"
          subtitle="전체 서버 프로젝트 목록이 아닌 방문 이력입니다. 기존 브라우저 자료는 설정의 데이터 이관에서 확인하세요."
        >
          {model.error && <Notice alert>{model.error}</Notice>}
          {model.loading && <Empty>방문한 프로젝트의 현재 접근권을 확인하는 중입니다.</Empty>}
          <View style={styles.heading}>
            <Text style={text.heading} accessibilityRole="header">
              음악 목록
            </Text>
            <Pill label="새 곡" primary onPress={() => act({ type: "start-song" })} />
          </View>
          {model.items.length === 0
            ? !model.loading &&
              !model.hasMore &&
              !model.error && (
                <Empty>
                  아직 작업 중인 곡이 없습니다. 새 곡을 만들거나 숏폼에서 작곡에 참여해보세요.
                </Empty>
              )
            : model.items.map((work) => (
                <Card key={work.id} style={styles.card}>
                  <WorkPreview tracks={work.preview} />
                  <View style={styles.row}>
                    <View style={styles.info}>
                      <Text style={text.bodyMuted}>{work.label}</Text>
                      <Text style={text.labelStrong} numberOfLines={1}>
                        {work.title}
                      </Text>
                      <Text style={text.bodyMuted}>
                        {work.layerCount}개 레이어 · {work.bpm} BPM
                      </Text>
                    </View>
                    <Pill
                      label="이어하기"
                      primary
                      accessibilityLabel={`${work.title} 이어하기`}
                      onPress={() =>
                        act({ type: "resume", projectId: work.id, shortId: work.shortId })
                      }
                    />
                  </View>
                </Card>
              ))}
          {model.hasMore && (
            <Wide label="더보기" disabled={model.appending} onPress={() => act({ type: "more" })} />
          )}
        </Page>
      </ScreenScroll>
    </>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  card: { gap: 10 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  info: { flex: 1, minWidth: 0, gap: 4 },
});
