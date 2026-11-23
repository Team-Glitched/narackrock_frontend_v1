import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import type { NativeAbyssAction, NativeAbyssParticipants } from "../../../src/lib/native-screens";
import { Avatar, Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter } from "../../ui/theme";

type Op = Extract<NativeAbyssAction, { type: "abyss-participants-op" }>["op"];

/** The web's ShortParticipants: composers and the owner selection of the listened short. */
export function Participants({ participants }: { participants: NativeAbyssParticipants }) {
  const { act, uri } = useScreen();
  const op = (value: Op) => act({ type: "abyss-participants-op", op: value });
  if (!participants.signedIn)
    return (
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.list}>
          {participants.people.length ? (
            participants.people.map((person) => (
              <Row
                key={person.userId}
                name={person.nickname}
                detail={person.role}
                avatar={null}
                onProfile={() => act({ type: "abyss-profile", userId: person.userId })}
              />
            ))
          ) : (
            <Text style={styles.empty}>아직 참여자가 없습니다.</Text>
          )}
          <Touchable accessibilityRole="button" style={styles.login} onPress={() => op("login")}>
            <Text style={styles.loginText}>로그인하고 참여자별 트랙 듣기</Text>
          </Touchable>
        </View>
      </ScrollView>
    );
  const { selectable } = participants;
  return (
    <ScrollView contentContainerStyle={[styles.body, styles.selection]}>
      <View style={styles.actions} accessibilityRole="toolbar" accessibilityLabel="참여자 선택">
        <Action label="전체 선택" disabled={!selectable} onPress={() => op("select-all")} />
        <Action label="해제" disabled={!selectable} onPress={() => op("clear")} />
        <Action label="전체 듣기" onPress={() => op("listen-all")} />
        <Action label="확인" primary onPress={() => op("confirm")} />
      </View>
      <StatusLine
        text={participants.stems.text}
        alert={participants.stems.error}
        onRetry={participants.stems.error ? () => op("retry-stems") : undefined}
      />
      {participants.composersLoading && <StatusLine text="참여자 정보를 불러오는 중..." />}
      {participants.composersError && (
        <StatusLine
          text={participants.composersError}
          alert
          onRetry={() => op("retry-composers")}
        />
      )}
      <View style={styles.list}>
        {participants.owners.map((owner) => (
          <Row
            key={owner.userId}
            name={owner.nickname}
            detail={owner.detail}
            avatar={uri(owner.profileImageUrl)}
            onProfile={() => act({ type: "abyss-profile", userId: owner.userId })}
          >
            <Touchable
              accessibilityRole="checkbox"
              accessibilityLabel={`${owner.nickname} 트랙 듣기`}
              accessibilityState={{ checked: owner.checked, disabled: !selectable }}
              disabled={!selectable}
              hitSlop={10}
              style={[
                styles.check,
                owner.checked && styles.checked,
                !selectable && styles.disabled,
              ]}
              onPress={() => act({ type: "abyss-participant-toggle", userId: owner.userId })}
            >
              {owner.checked && (
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M5 12.5l4.5 4.5L19 7.5"
                    stroke="#ffffff"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              )}
            </Touchable>
          </Row>
        ))}
        {participants.empty && <Text style={styles.empty}>아직 참여자가 없습니다.</Text>}
      </View>
    </ScrollView>
  );
}

function Row({
  name,
  detail,
  avatar,
  onProfile,
  children,
}: {
  name: string;
  detail: string;
  avatar: string | null;
  onProfile: () => void;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.row}>
      <Touchable
        accessibilityRole="link"
        accessibilityLabel={`${name} 프로필 보기`}
        onPress={onProfile}
      >
        <Avatar uri={avatar} size={32} />
      </Touchable>
      <View style={styles.rowText}>
        <Touchable accessibilityRole="link" onPress={onProfile}>
          <Text style={styles.name}>{name}</Text>
        </Touchable>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      {children}
    </View>
  );
}

function Action({
  label,
  primary = false,
  disabled = false,
  onPress,
}: {
  label: string;
  primary?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={[styles.action, primary && styles.actionPrimary, disabled && styles.disabled]}
      onPress={onPress}
    >
      <Text style={styles.actionText}>{label}</Text>
    </Touchable>
  );
}

function StatusLine({
  text,
  alert = false,
  onRetry,
}: {
  text: string;
  alert?: boolean;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.statusRow}>
      <Text
        accessibilityRole={alert ? "alert" : undefined}
        accessibilityLiveRegion="polite"
        style={styles.status}
      >
        {text}
      </Text>
      {onRetry && (
        <Touchable accessibilityRole="button" hitSlop={8} onPress={onRetry}>
          <Text style={styles.retry}>다시 시도</Text>
        </Touchable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: gutter, paddingBottom: 24 },
  selection: { gap: 16 },
  list: { gap: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { flex: 1, gap: 4 },
  name: { color: colors.fg, fontSize: 16, lineHeight: 20, fontWeight: "700" },
  detail: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  empty: { color: colors.fg, fontSize: 14, lineHeight: 20 },
  login: { alignSelf: "flex-start", minHeight: 32, justifyContent: "center" },
  loginText: { color: colors.fg, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: colors.surface,
  },
  actionPrimary: { marginLeft: "auto", backgroundColor: colors.primary },
  actionText: { color: colors.fg, fontSize: 14, lineHeight: 18, fontWeight: "600" },
  disabled: { opacity: 0.4 },
  statusRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  status: { flexShrink: 1, color: colors.muted, fontSize: 14, lineHeight: 18 },
  retry: {
    color: colors.fg,
    fontSize: 14,
    lineHeight: 18,
    textDecorationLine: "underline",
  },
  check: {
    width: 24,
    height: 24,
    marginLeft: "auto",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 4,
    borderWidth: 2,
    borderColor: colors.line,
  },
  checked: { borderColor: colors.primary, backgroundColor: colors.primary },
});
