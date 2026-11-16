import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import BackIcon from "../../../public/figma/search-back.svg";
import type { NativeAdminMembers } from "../../../src/lib/native-screens";
import { AppHeader } from "../../ui/header";
import { Button, TextField, Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";
import type { ScreenProps } from "../types";
import {
  adminStyles,
  Card,
  CardActions,
  CardButton,
  CardTitle,
  Line,
  PageState,
  PageStateText,
  SignInRequired,
  WideButton,
} from "./parts";

/**
 * The web community management pages (src/features/admin/admin-screens.tsx CommunityAdminScreen
 * and its CommunityMembers, under community-management-content.tsx).
 */
export function AdminCommunityScreen({ model, header }: ScreenProps<"admin-community">) {
  const { act } = useScreen();
  const { view } = model;
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenScroll>
        {view.type === "page-state" ? (
          <PageState error={view.error}>
            <PageStateText error={view.error}>{view.text}</PageStateText>
          </PageState>
        ) : view.type === "sign-in" ? (
          <SignInRequired text={view.text} onSignIn={() => act({ type: "sign-in" })} />
        ) : view.type === "galleries" ? (
          <View style={styles.status}>
            <Title />
            {view.status === "loading" && (
              <StatusText>관리 가능한 커뮤니티를 불러오는 중...</StatusText>
            )}
            {view.status === "error" && (
              <>
                <StatusText alert>관리 가능한 커뮤니티를 불러오지 못했습니다.</StatusText>
                <Button label="다시 시도" tone="secondary" onPress={() => act({ type: "retry" })} />
              </>
            )}
            {view.status === "empty" && (
              <StatusText>관리할 수 있는 커뮤니티가 없습니다.</StatusText>
            )}
            {view.status === "ready" && (
              <View style={styles.galleries}>
                {view.items.map((gallery) => (
                  <WideButton
                    key={gallery.galleryId}
                    label={`${gallery.name} 관리`}
                    onPress={() => act({ type: "select", galleryId: gallery.galleryId })}
                  />
                ))}
              </View>
            )}
          </View>
        ) : view.type === "status" ? (
          <View style={styles.status}>
            <Title />
            <StatusText alert={view.error}>{view.text}</StatusText>
            {view.button && (
              <Button
                label={view.button === "retry" ? "다시 시도" : "돌아가기"}
                tone="secondary"
                onPress={() => act({ type: view.button === "retry" ? "retry" : "leave" })}
              />
            )}
          </View>
        ) : (
          <Members members={view} />
        )}
      </ScreenScroll>
    </>
  );
}

function Title() {
  return (
    <Text style={type.title} accessibilityRole="header">
      커뮤니티 관리
    </Text>
  );
}

/** communityAdminStatus paragraphs: muted body text, alerts included. */
function StatusText({ children, alert = false }: { children: string; alert?: boolean }) {
  return (
    <Text style={type.muted} accessibilityRole={alert ? "alert" : undefined}>
      {children}
    </Text>
  );
}

function Members({ members }: { members: NativeAdminMembers }) {
  const { act } = useScreen();
  const [description, setDescription] = useState(members.description);
  const { bans, logs } = members;
  return (
    <View accessibilityLabel={`${members.name} 운영`}>
      <View style={styles.backLine}>
        <Touchable
          accessibilityRole="button"
          accessibilityLabel="돌아가기"
          style={styles.back}
          onPress={() => act({ type: "leave" })}
        >
          <BackIcon width={22} height={22} />
        </Touchable>
      </View>
      <View style={adminStyles.body}>
        <Text style={[type.muted, styles.notice]}>
          전체 멤버 목록은 현재 서버에서 지원하지 않습니다. 게시글·댓글 메뉴에서 작성자를 제재할 수
          있습니다.
        </Text>
        <Card>
          <CardTitle>커뮤니티 설명</CardTitle>
          <TextField
            accessibilityLabel="커뮤니티 설명"
            multiline
            maxLength={1000}
            value={description}
            onChangeText={setDescription}
          />
          {members.notice !== "" && <Text style={type.muted}>{members.notice}</Text>}
          <CardActions>
            <CardButton
              label={members.saving ? "저장 중..." : "설명 저장"}
              primary
              disabled={members.saving}
              onPress={() => act({ type: "save-description", text: description })}
            />
          </CardActions>
        </Card>
        <Text style={styles.heading} accessibilityRole="header">
          제재 내역
        </Text>
        {bans.error && <Line error>{bans.error}</Line>}
        {bans.loaded && bans.items.length === 0 && <Line>제재 내역이 없습니다.</Line>}
        {bans.items.map((ban) => (
          <Card key={ban.banId}>
            <Text style={type.muted}>{ban.status}</Text>
            <CardTitle>{ban.title}</CardTitle>
            <Text style={type.muted}>{ban.reason}</Text>
            <Text style={type.caption}>{ban.period}</Text>
            {ban.active && (
              <CardActions>
                <CardButton
                  label="제재 해제"
                  disabled={members.lifting}
                  onPress={() => act({ type: "lift-ban", banId: ban.banId })}
                />
              </CardActions>
            )}
          </Card>
        ))}
        {bans.hasMore && (
          <WideButton
            label="제재 내역 더보기"
            disabled={bans.appending}
            onPress={() => act({ type: "more-bans" })}
          />
        )}
        <Text style={styles.heading} accessibilityRole="header">
          운영 기록
        </Text>
        {logs.error && <Line error>{logs.error}</Line>}
        {logs.loaded && logs.items.length === 0 && <Line>운영 기록이 없습니다.</Line>}
        {logs.items.map((log) => (
          <Text key={log.logId} style={type.body}>
            {log.text}
          </Text>
        ))}
        {logs.hasMore && (
          <WideButton
            label="운영 기록 더보기"
            disabled={logs.appending}
            onPress={() => act({ type: "more-logs" })}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  status: {
    paddingHorizontal: gutter,
    paddingVertical: 24,
    gap: 20,
    alignItems: "flex-start",
  },
  galleries: { alignSelf: "stretch", gap: 12 },
  backLine: { paddingTop: 20, paddingLeft: 6, paddingRight: 10, flexDirection: "row" },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  notice: { marginTop: 12 },
  // The web's section h2s here are unstyled: plain 16px text.
  heading: { marginTop: 12, color: colors.fg, fontSize: 16, lineHeight: 22 },
});
