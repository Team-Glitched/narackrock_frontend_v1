import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import type { NativeCommunity } from "../../src/lib/native-screens";
import { Avatar, Touchable } from "./kit";
import { useScreen } from "./screen-context";
import { colors, gutter, type } from "./theme";

/** The web's CommunityCard: avatar, name, member count, join control, description. */
export function CommunityCard({
  community,
  onOpen,
  onToggleJoin,
}: {
  community: NativeCommunity;
  onOpen: () => void;
  onToggleJoin: () => void;
}) {
  const { uri } = useScreen();
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Avatar uri={uri(community.imageUrl)} size={40} />
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`${community.name} 커뮤니티 열기`}
          style={styles.title}
          onPress={onOpen}
        >
          <Text style={type.label} numberOfLines={1}>
            {community.name}
          </Text>
          <Text style={type.caption}>{community.memberLabel}</Text>
        </Touchable>
        <JoinButton community={community} onPress={onToggleJoin} />
      </View>
      {community.description !== "" && (
        <Text style={type.muted}>{community.description}</Text>
      )}
    </View>
  );
}

/** Same states and labels as the web's CommunityJoinButton. */
export function JoinButton({
  community,
  onPress,
}: {
  community: NativeCommunity;
  onPress: () => void;
}) {
  const { join, joinPending, name } = community;
  if (join === "owner")
    return (
      <View style={[styles.join, styles.joined]}>
        <Text style={styles.joinText}>가입됨</Text>
      </View>
    );
  const label =
    join === "loading"
      ? "가입 상태 확인 중"
      : join === "failed"
        ? "가입 상태를 불러오지 못했습니다"
        : join === "joined"
          ? "가입됨 — 누르면 탈퇴"
          : "가입하기";
  const disabled = joinPending || join === "loading" || join === "failed";
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={`${name} ${label}`}
      accessibilityState={{ disabled, busy: joinPending, selected: join === "joined" }}
      disabled={disabled}
      style={[styles.join, join === "joined" && styles.joined, disabled && { opacity: 0.6 }]}
      onPress={onPress}
    >
      {join === "loading" || joinPending ? (
        <ActivityIndicator size="small" color={colors.fg} />
      ) : (
        <Text style={styles.joinText}>
          {join === "failed" ? "‒" : join === "joined" ? "가입됨" : "가입"}
        </Text>
      )}
    </Touchable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: gutter,
    padding: 16,
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1, gap: 2 },
  join: {
    minWidth: 64,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  joined: { backgroundColor: colors["primary-deep"] },
  joinText: { color: colors.fg, fontSize: 14, fontWeight: "600" },
});
