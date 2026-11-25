import { useState, type ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import BackIcon from "../../../public/figma/search-back.svg";
import SearchIcon from "../../../public/figma/search-input.svg";
import {
  COMMUNITY_DESCRIPTION_MAX_LENGTH,
  SEARCH_QUERY_MAX_LENGTH,
  clampCodePoints,
  codePointLength,
  sanitizeMultiline,
} from "../../../src/lib/content-limits";
import type { NativeAdminMembers } from "../../../src/lib/native-screens";
import { AppHeader } from "../../ui/header";
import { Avatar, Button, TextField, Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";
import type { ScreenProps } from "../types";
import {
  CardButton,
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

/** The web's ManageSection: a section title over its content. */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section} accessibilityLabel={title}>
      <Text style={type.title} accessibilityRole="header">
        {title}
      </Text>
      {children}
    </View>
  );
}

/** The web's ManageRow: avatar (when given), a bold title and muted lines, then the action. */
function Row({
  avatar,
  title,
  lines,
  children,
}: {
  avatar?: { uri: string | null };
  title: string;
  lines: string[];
  children?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      {avatar && <Avatar uri={avatar.uri} size={32} />}
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {lines.filter(Boolean).map((line) => (
          <Text key={line} style={type.muted}>
            {line}
          </Text>
        ))}
      </View>
      {children}
    </View>
  );
}

/** The web's CommunityImagesEditor: icon and banner previews, file pick, remove, save. */
function CommunityImages({ images }: { images: NativeAdminMembers["images"] }) {
  const { act, uri } = useScreen();
  const { busy } = images;
  return (
    <View style={styles.images}>
      {images.items.map((item) => {
        const preview = uri(item.previewUrl);
        return (
          <View key={item.key} style={styles.imageField} accessibilityLabel={item.label}>
            <Text style={styles.imageLegend}>{item.label}</Text>
            {item.hasImage ? (
              <View style={item.key === "icon" ? styles.iconPreview : styles.bannerPreview}>
                {preview && (
                  <Image
                    source={{ uri: preview }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                    accessibilityLabel={`${item.label} 미리보기`}
                  />
                )}
              </View>
            ) : (
              <Text style={type.caption}>등록된 이미지가 없습니다.</Text>
            )}
            <View style={styles.imageButton}>
              <CardButton
                label="파일 선택"
                accessibilityLabel={`${item.label} 파일 선택`}
                disabled={busy}
                onPress={() => act({ type: "pick-community-image", key: item.key })}
              />
            </View>
            {item.hasImage && (
              <Touchable
                accessibilityRole="button"
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                hitSlop={8}
                style={styles.imageRemove}
                onPress={() => act({ type: "remove-community-image", key: item.key })}
              >
                <Text style={type.caption}>{item.label} 제거</Text>
              </Touchable>
            )}
          </View>
        );
      })}
      {images.error && (
        <Text accessibilityRole="alert" style={styles.imageNotice}>
          {images.error}
        </Text>
      )}
      {images.saved && (
        <Text accessibilityLiveRegion="polite" style={type.caption}>
          커뮤니티 이미지를 저장했습니다.
        </Text>
      )}
      <Button
        label={busy ? "이미지 저장 중..." : "이미지 저장"}
        disabled={!images.canSave}
        onPress={() => act({ type: "save-community-images" })}
      />
    </View>
  );
}

function Members({ members }: { members: NativeAdminMembers }) {
  const { act } = useScreen();
  const [description, setDescription] = useState(members.description);
  const [keyword, setKeyword] = useState("");
  const { bans, logs, managers, managerSearch, managerBusy } = members;
  const search = () => act({ type: "search-managers", keyword });
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
        <View style={styles.rowText} accessibilityRole="header">
          <Text style={type.title} numberOfLines={1}>
            {members.name}
          </Text>
          <Text style={type.muted}>커뮤니티 관리</Text>
        </View>
      </View>
      <View style={styles.body}>
        <Section title="커뮤니티 어드민">
          {members.managerNotice !== "" && <Line>{members.managerNotice}</Line>}
          {managers.error ? (
            <Line error>{managers.error}</Line>
          ) : !managers.loaded ? (
            <Line>불러오는 중...</Line>
          ) : (
            managers.items.length === 0 && <Line>지정된 커뮤니티 어드민이 없습니다.</Line>
          )}
          {managers.items.map((manager) => (
            <Row
              key={manager.userId}
              avatar={{ uri: manager.avatarUrl }}
              title={manager.title}
              lines={[manager.meta]}
            >
              <CardButton
                label="해임"
                disabled={managerBusy}
                onPress={() => act({ type: "revoke-manager", userId: manager.userId })}
              />
            </Row>
          ))}
        </Section>
        <Section title="어드민 지정">
          <View style={styles.search}>
            <TextField
              accessibilityLabel="닉네임으로 사용자 검색"
              placeholder="닉네임으로 사용자 검색"
              value={keyword}
              onChangeText={(value) => setKeyword(clampCodePoints(value, SEARCH_QUERY_MAX_LENGTH))}
              returnKeyType="search"
              onSubmitEditing={search}
              style={styles.searchInput}
            />
            <Touchable
              accessibilityRole="button"
              accessibilityLabel="검색"
              style={styles.searchButton}
              onPress={search}
            >
              <SearchIcon width={24} height={24} />
            </Touchable>
          </View>
          {managerSearch.status === "idle" && <Line>지정할 사용자의 닉네임을 검색하세요.</Line>}
          {managerSearch.status === "loading" && <Line>검색 중...</Line>}
          {managerSearch.status === "error" && <Line error>사용자를 검색하지 못했습니다.</Line>}
          {managerSearch.status === "ready" && managerSearch.items.length === 0 && (
            <Line>검색 결과가 없습니다.</Line>
          )}
          {managerSearch.items.map((person) => (
            <Row
              key={person.userId}
              avatar={{ uri: person.avatarUrl }}
              title={person.title}
              lines={[person.subtitle]}
            >
              {person.manager ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>어드민</Text>
                </View>
              ) : (
                <CardButton
                  label="지정"
                  primary
                  disabled={managerBusy}
                  onPress={() => act({ type: "grant-manager", userId: person.userId })}
                />
              )}
            </Row>
          ))}
          {managerSearch.status === "ready" && managerSearch.hasMore && (
            <WideButton
              label="검색 결과 더보기"
              disabled={managerSearch.loadingMore}
              onPress={() => act({ type: "more-manager-search" })}
            />
          )}
        </Section>
        <Section title="커뮤니티 이미지">
          <CommunityImages images={members.images} />
        </Section>
        <Section title="커뮤니티 설명">
          <TextField
            accessibilityLabel="커뮤니티 설명"
            placeholder="커뮤니티를 소개해 주세요."
            multiline
            value={description}
            onChangeText={(value) =>
              setDescription(clampCodePoints(value, COMMUNITY_DESCRIPTION_MAX_LENGTH))
            }
            style={styles.textarea}
          />
          <View style={styles.footer}>
            <Text style={type.muted}>
              {codePointLength(description)}/{COMMUNITY_DESCRIPTION_MAX_LENGTH}
            </Text>
            <CardButton
              label={members.saving ? "저장 중..." : "저장"}
              primary
              disabled={members.saving}
              onPress={() =>
                act({ type: "save-description", text: sanitizeMultiline(description) })
              }
            />
          </View>
          {members.notice !== "" && <Line>{members.notice}</Line>}
        </Section>
        <Section title="제재 내역">
          <Line>멤버 제재는 게시글·댓글의 메뉴에서 할 수 있습니다.</Line>
          {bans.error && <Line error>{bans.error}</Line>}
          {bans.loaded && !bans.error && bans.items.length === 0 && (
            <Line>제재 내역이 없습니다.</Line>
          )}
          {bans.items.map((ban) => (
            <Row
              key={ban.banId}
              avatar={{ uri: null }}
              title={ban.title}
              lines={[`${ban.status} · ${ban.reason}`, ban.period]}
            >
              {ban.active && (
                <CardButton
                  label="해제"
                  disabled={members.lifting}
                  onPress={() => act({ type: "lift-ban", banId: ban.banId })}
                />
              )}
            </Row>
          ))}
          {bans.hasMore && (
            <WideButton
              label="제재 내역 더보기"
              disabled={bans.appending}
              onPress={() => act({ type: "more-bans" })}
            />
          )}
        </Section>
        <Section title="운영 기록">
          {logs.error && <Line error>{logs.error}</Line>}
          {logs.loaded && !logs.error && logs.items.length === 0 && (
            <Line>운영 기록이 없습니다.</Line>
          )}
          {logs.items.map((log) => (
            <Row key={log.logId} title={log.title} lines={[log.detail, log.time]} />
          ))}
          {logs.hasMore && (
            <WideButton
              label="운영 기록 더보기"
              disabled={logs.appending}
              onPress={() => act({ type: "more-logs" })}
            />
          )}
        </Section>
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
  backLine: {
    paddingTop: 20,
    paddingLeft: 6,
    paddingRight: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  // communityMembersContent: sections 40 apart.
  body: { paddingHorizontal: gutter, paddingTop: 20, paddingBottom: 40, gap: 40 },
  section: { gap: 12 },
  // CommunityImagesEditor: fieldsets 16 apart, 12 inside; icon 80 round, banner 3:1.
  images: { gap: 16 },
  imageField: { gap: 12 },
  imageLegend: { ...type.body, fontWeight: "600" },
  iconPreview: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  bannerPreview: {
    width: "100%",
    aspectRatio: 3,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  imageButton: { alignSelf: "flex-start" },
  imageRemove: { alignSelf: "flex-start" },
  imageNotice: { ...type.caption, color: colors.fg },
  // communityMemberRow / communityMemberProfile.
  row: { minHeight: 56, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { ...type.label, fontWeight: "700" },
  // communityAdminSearch: the search screen's rounded field.
  search: {
    height: 40,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.surface,
  },
  searchInput: { flex: 1, minHeight: 40, paddingHorizontal: 0, paddingVertical: 0, backgroundColor: "transparent" },
  searchButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  // communityManageTextarea: the create form's bordered field.
  textarea: {
    minHeight: 104,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "transparent",
    padding: 10,
    lineHeight: 22,
  },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  // badgeVariants({ status: "resource" }).
  badge: {
    minHeight: 24,
    paddingHorizontal: 12,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#7c3aed",
    backgroundColor: "#7c3aed",
    justifyContent: "center",
  },
  badgeText: { color: "#ffffff", fontSize: 13, lineHeight: 16, fontWeight: "600" },
});
