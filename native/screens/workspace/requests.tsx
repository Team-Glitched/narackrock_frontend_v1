import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppHeader } from "../../ui/header";
import { Avatar, Button, TextField, Touchable } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { MODERATION_REASON_MAX_LENGTH, clampCodePoints } from "../../../src/lib/content-limits";
import { ArrowUpRight, Empty, StatusBadge, text } from "./parts";

/** The web's sent requests page (contribution-requests.tsx SubmissionsScreen). */
export function WorkspaceSubmissionsScreen({
  model,
  header,
}: ScreenProps<"workspace-submissions">) {
  const { act } = useScreen();
  const { items } = model;
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenScroll>
        <View style={styles.page}>
          {items.length > 0 && <Title>보낸 참여 요청</Title>}
          {model.loading && <Empty>참여 요청을 불러오는 중...</Empty>}
          {model.failed && (
            <Empty
              action={
                <Button label="다시 시도" tone="secondary" onPress={() => act({ type: "retry" })} />
              }
            >
              보낸 요청을 불러오지 못했습니다.
            </Empty>
          )}
          {!model.loading && !model.failed && items.length === 0 && (
            <Empty
              action={
                <Button
                  label="새로고침"
                  tone="secondary"
                  disabled={model.fetching}
                  onPress={() => act({ type: "reload" })}
                />
              }
            >
              아직 보낸 참여 요청이 없습니다.
            </Empty>
          )}
          <View>
            {items.map((item, index) => (
              <Touchable
                key={`${item.projectId}:${item.contributionId}`}
                accessibilityRole="button"
                style={[styles.sentRow, index > 0 && styles.divider]}
                onPress={() =>
                  act({
                    type: "open",
                    contributionId: item.contributionId,
                    projectId: item.projectId,
                  })
                }
              >
                <View style={styles.sentTop}>
                  <StatusBadge status={item.status} />
                  <Text style={text.caption}>{item.ageLabel}</Text>
                </View>
                <Text style={text.labelStrong}>{item.projectTitle}</Text>
                {item.description && (
                  <Text style={[text.bodyMuted, styles.sentDescription]}>{item.description}</Text>
                )}
                <Text style={styles.link}>요청 상세 보기 →</Text>
              </Touchable>
            ))}
          </View>
          {model.paging && (
            <Button
              label={model.paging.busy ? "불러오는 중..." : "더보기"}
              tone="secondary"
              disabled={model.paging.busy}
              onPress={() => act({ type: "more" })}
            />
          )}
        </View>
      </ScreenScroll>
    </>
  );
}

/** The web's request detail (contribution-requests.tsx SubmissionDetailScreen). */
export function WorkspaceSubmissionScreen({ model, header }: ScreenProps<"workspace-submission">) {
  const { act, uri } = useScreen();
  const [reason, setReason] = useState("");
  let body;
  if (model.state === "loading") body = <Empty>{model.message}</Empty>;
  else if (model.state === "invalid") body = <Empty tone="error">{model.message}</Empty>;
  else if (model.state === "error")
    body = (
      <Empty
        tone="error"
        action={
          <Button label="다시 시도" tone="secondary" onPress={() => act({ type: "retry" })} />
        }
      >
        {model.message}
      </Empty>
    );
  else
    body = (
      <View style={styles.page}>
        <Title>{model.title}</Title>
        <View style={styles.person}>
          <Avatar uri={uri(model.profileImageUrl)} size={32} />
          <View style={styles.flex}>
            <Text style={[text.caption, styles.role]}>{model.roleLabel}</Text>
            <Text style={text.labelStrong}>{model.nickname}</Text>
          </View>
          <Text style={text.caption}>{model.ageLabel}</Text>
        </View>
        <StatusBadge status={model.status} />
        <Text style={[text.labelStrong, styles.projectTitle]}>{model.projectTitle}</Text>
        {model.description && (
          <Text style={[text.bodyMuted, styles.detailDescription]}>{model.description}</Text>
        )}
        {model.rejectReason && (
          <View style={styles.reject} accessibilityLabel="거절 사유">
            <Text style={[text.labelStrong, styles.rejectTitle]}>거절 사유</Text>
            <Text style={text.body}>{model.rejectReason}</Text>
          </View>
        )}
        <Touchable
          accessibilityRole="button"
          style={styles.resume}
          onPress={() => act({ type: "resume" })}
        >
          <Text style={styles.resumeText}>전체 트랙 보기</Text>
          <ArrowUpRight size={20} />
        </Touchable>
        {model.canReview && (
          <>
            <View style={styles.reasonField}>
              <Text style={[text.labelStrong, styles.reasonLabel]}>거절 사유 (선택)</Text>
              <TextField
                multiline
                accessibilityLabel="거절 사유 (선택)"
                placeholder="거절할 때 참여자에게 보여줄 사유를 적어 주세요."
                value={reason}
                editable={!model.reviewBusy}
                onChangeText={(value) =>
                  setReason(clampCodePoints(value, MODERATION_REASON_MAX_LENGTH))
                }
                style={styles.reason}
              />
            </View>
            <ReviewButtons
              busy={model.reviewBusy}
              onReview={(status) => act({ type: "review", status, reason })}
            />
          </>
        )}
        {model.reviewError && <ReviewError message={model.reviewError} />}
      </View>
    );
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenScroll>{body}</ScreenScroll>
    </>
  );
}

/** The web's received requests page (contribution-requests.tsx ReviewInboxScreen). */
export function WorkspaceReviewsScreen({ model, header }: ScreenProps<"workspace-reviews">) {
  const { act } = useScreen();
  const { items } = model;
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenScroll>
        <View style={styles.page}>
          {items.length > 0 && <Title>받은 참여 요청</Title>}
          {model.status === "loading" && <Empty>참여 요청을 불러오는 중...</Empty>}
          {model.status === "error" && (
            <Empty
              action={
                <Button label="다시 시도" tone="secondary" onPress={() => act({ type: "retry" })} />
              }
            >
              참여 요청을 불러오지 못했습니다.
            </Empty>
          )}
          {model.reviewError && <ReviewError message={model.reviewError} />}
          {model.notice && (
            <Text accessibilityRole="alert" style={[text.label, styles.notice]}>
              {model.notice}
            </Text>
          )}
          {model.status === "ready" && items.length === 0 && (
            <Empty
              action={
                <Button
                  label="새로고침"
                  tone="secondary"
                  disabled={model.fetching}
                  onPress={() => act({ type: "reload" })}
                />
              }
            >
              받은 참여 요청이 없습니다.
            </Empty>
          )}
          <View>
            {items.map((item, index) => (
              <View
                key={`${item.projectId}:${item.contributionId}`}
                style={[styles.card, index > 0 && styles.divider]}
              >
                <View style={styles.avatar}>
                  <Avatar uri={null} size={32} />
                </View>
                <View style={styles.flex}>
                  <View style={styles.cardTop}>
                    <Touchable
                      accessibilityRole="button"
                      style={styles.flexShrink}
                      onPress={() => act({ type: "open-profile", userId: item.userId })}
                    >
                      <Text style={text.labelStrong}>{item.nickname}</Text>
                    </Touchable>
                    <Text style={text.caption}>{item.ageLabel}</Text>
                  </View>
                  <Text style={[text.body, styles.cardText]}>
                    <Text style={styles.medium}>{item.projectTitle}</Text>에 참여를 요청했어요.
                  </Text>
                  {item.description && (
                    <Text style={[text.caption, styles.cardText]}>{item.description}</Text>
                  )}
                  <View style={styles.cardLinks}>
                    <Touchable
                      accessibilityRole="button"
                      style={styles.cardLink}
                      onPress={() =>
                        act({
                          type: "open-project",
                          projectId: item.projectId,
                          contributionId: item.contributionId,
                        })
                      }
                    >
                      <Text style={[text.caption, styles.soft]}>전체 트랙 보기</Text>
                      <ArrowUpRight size={16} color={colors["primary-soft"]} />
                    </Touchable>
                    <Touchable
                      accessibilityRole="button"
                      style={styles.cardLink}
                      onPress={() =>
                        act({
                          type: "open-details",
                          contributionId: item.contributionId,
                          projectId: item.projectId,
                        })
                      }
                    >
                      <Text style={text.caption}>상세 보기</Text>
                    </Touchable>
                  </View>
                  <ReviewButtons
                    busy={model.reviewBusy}
                    onReview={(status) =>
                      act({
                        type: "review",
                        projectId: item.projectId,
                        contributionId: item.contributionId,
                        status,
                      })
                    }
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScreenScroll>
    </>
  );
}

function Title({ children }: { children: string }) {
  return (
    <Text style={styles.title} accessibilityRole="header">
      {children}
    </Text>
  );
}

function ReviewError({ message }: { message: string }) {
  return (
    <Text accessibilityRole="alert" style={text.error}>
      {message}
    </Text>
  );
}

/** The web's ContributionReviewActions. */
function ReviewButtons({
  busy,
  onReview,
}: {
  busy: boolean;
  onReview: (status: "APPROVED" | "REJECTED") => void;
}) {
  return (
    <View style={styles.review} accessibilityLabel="참여 요청 처리">
      <Button label="수락" disabled={busy} onPress={() => onReview("APPROVED")} />
      <Button label="거절" tone="secondary" disabled={busy} onPress={() => onReview("REJECTED")} />
      {busy && <Text style={text.caption}>처리 중...</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: gutter, paddingTop: 16, paddingBottom: 40, gap: 14 },
  title: { color: colors.fg, fontSize: 20, lineHeight: 28, fontWeight: "700" },
  flex: { flex: 1, minWidth: 0 },
  flexShrink: { flexShrink: 1 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sentRow: { paddingVertical: 18, gap: 8 },
  sentTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  sentDescription: { lineHeight: 24 },
  link: { marginTop: 4, color: colors["primary-soft"], fontSize: 14, lineHeight: 18 },
  person: { flexDirection: "row", alignItems: "center", gap: 12 },
  role: { marginBottom: 2 },
  projectTitle: { lineHeight: 24 },
  detailDescription: { lineHeight: 28 },
  reject: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rejectTitle: { color: colors.muted, marginBottom: 4 },
  resume: {
    marginTop: 6,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  resumeText: { color: colors.fg, fontSize: 16, lineHeight: 22, fontWeight: "500" },
  reasonField: { marginTop: 24 },
  reasonLabel: { marginBottom: 8, color: colors.muted },
  reason: { minHeight: 80, borderWidth: 1, borderColor: colors.border, fontSize: 14 },
  review: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16 },
  notice: { color: colors["primary-soft"] },
  card: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 16 },
  avatar: { paddingTop: 4 },
  cardTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  cardText: { marginTop: 8 },
  medium: { fontWeight: "500" },
  cardLinks: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 16,
    rowGap: 8,
  },
  cardLink: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 4 },
  soft: { color: colors["primary-soft"] },
});
