import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { parseBanDays } from "../../../src/features/admin/ban-days";
import { MODERATION_REASON_MAX_LENGTH, clampCodePoints } from "../../../src/lib/content-limits";
import type {
  NativeAdminProposal,
  NativeAdminReport,
  NativeReportAction,
} from "../../../src/lib/native-screens";
import { AppHeader } from "../../ui/header";
import { TextField } from "../../ui/kit";
import { ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors, type } from "../../ui/theme";
import type { ScreenProps } from "../types";
import {
  adminStyles,
  Card,
  CardActions,
  CardButton,
  CardTitle,
  Line,
  Pills,
  SignInRequired,
  WideButton,
} from "./parts";

const tabs = [
  { value: "proposals" as const, label: "개설 신청" },
  { value: "reports" as const, label: "신고" },
];

/** The web admin page (src/features/admin/admin-screens.tsx AdminReviewScreen). */
export function AdminReviewScreen({ model, header }: ScreenProps<"admin-review">) {
  const { act } = useScreen();
  const list = model.tab === "proposals" ? model.proposals : model.reports;
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenScroll>
        {!model.signedIn ? (
          <SignInRequired
            text="운영자 관리 화면은 로그인 후 사용할 수 있습니다."
            onSignIn={() => act({ type: "sign-in" })}
          />
        ) : (
          <View style={adminStyles.body} accessibilityLabel="운영자 관리">
            <Text style={[type.title, adminStyles.title]} accessibilityRole="header">
              운영자 관리
            </Text>
            <Pills options={tabs} value={model.tab} onChange={(tab) => act({ type: "tab", tab })} />
            {!list.loaded && <Line>불러오는 중...</Line>}
            {list.error && <Line error>{list.error}</Line>}
            {list.loaded && !list.error && list.items.length === 0 && (
              <Line>대기 중인 항목이 없습니다.</Line>
            )}
            {model.tab === "proposals"
              ? model.proposals.items.map((proposal) => (
                  <ProposalCard key={proposal.proposalId} proposal={proposal} />
                ))
              : model.reports.items.map((report) => (
                  <ReportCard key={report.reportId} report={report} />
                ))}
            {list.hasMore && (
              <WideButton
                label="더보기"
                disabled={list.appending}
                onPress={() => act({ type: "more" })}
              />
            )}
          </View>
        )}
      </ScreenScroll>
    </>
  );
}

function ProposalCard({ proposal }: { proposal: NativeAdminProposal }) {
  const { act } = useScreen();
  const [reason, setReason] = useState("");
  const { busy, error } = proposal;
  return (
    <Card>
      <Text style={styles.status}>커뮤니티 개설 신청</Text>
      <CardTitle>{proposal.name}</CardTitle>
      <Text style={type.muted}>{proposal.description}</Text>
      <Text style={styles.small}>{proposal.meta}</Text>
      <TextField
        accessibilityLabel={`${proposal.name} 반려 사유`}
        placeholder="반려 사유"
        value={reason}
        onChangeText={(value) => setReason(clampCodePoints(value, MODERATION_REASON_MAX_LENGTH))}
      />
      {error !== "" && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <CardActions>
        <CardButton
          label="반려"
          disabled={busy || !reason.trim()}
          onPress={() =>
            act({ type: "reject", proposalId: proposal.proposalId, reason: reason.trim() })
          }
        />
        <CardButton
          label="승인"
          primary
          disabled={busy}
          onPress={() => act({ type: "approve", proposalId: proposal.proposalId })}
        />
      </CardActions>
    </Card>
  );
}

function ReportCard({ report }: { report: NativeAdminReport }) {
  const { act } = useScreen();
  const [action, setAction] = useState<NativeReportAction>(report.actions[0].value);
  const [reason, setReason] = useState("");
  const [days, setDays] = useState("");
  const { busy, error } = report;
  const { banDays, valid: validDays } = parseBanDays(days);
  return (
    <Card>
      <Text style={styles.status}>{report.target}</Text>
      <CardTitle>{report.reason}</CardTitle>
      {report.description && <Text style={type.muted}>{report.description}</Text>}
      {report.contentSummary && <Text style={type.muted}>“{report.contentSummary}”</Text>}
      <Text style={styles.small}>{report.meta}</Text>
      <View style={styles.handling}>
        <Text style={type.body}>처리</Text>
        <View style={styles.flex}>
          <Pills
            label="신고 처리 방식"
            options={report.actions}
            value={action}
            onChange={setAction}
          />
        </View>
      </View>
      {action === "BAN_USER" && (
        <TextField
          accessibilityLabel="정지 기간(일, 비우면 영구)"
          placeholder="정지 기간(일) · 비우면 영구"
          keyboardType="number-pad"
          value={days}
          onChangeText={setDays}
        />
      )}
      <TextField
        accessibilityLabel="처리 사유"
        placeholder="처리 사유"
        value={reason}
        onChangeText={(value) => setReason(clampCodePoints(value, MODERATION_REASON_MAX_LENGTH))}
      />
      {error !== "" && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      <CardActions>
        <CardButton
          label="신고 반려"
          disabled={busy || !reason.trim()}
          onPress={() =>
            act({ type: "reject-report", reportId: report.reportId, reason: reason.trim() })
          }
        />
        <CardButton
          label="처리"
          primary
          disabled={busy || !reason.trim() || (action === "BAN_USER" && !validDays)}
          onPress={() =>
            act({
              type: "resolve-report",
              reportId: report.reportId,
              action,
              reason: reason.trim(),
              banDays: action === "BAN_USER" ? banDays : null,
            })
          }
        />
      </CardActions>
    </Card>
  );
}

const styles = StyleSheet.create({
  status: { ...type.muted },
  small: { ...type.caption },
  error: { ...type.body, color: colors.error },
  handling: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  flex: { flex: 1 },
});
