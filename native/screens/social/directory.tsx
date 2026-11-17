import { FlatList, StyleSheet, Text, View } from "react-native";

import type {
  NativeCommunity,
  NativeCommunityDirectory,
  NativeCommunityList,
} from "../../../src/lib/native-screens";
import { CommunityCard, JoinButton } from "../../ui/community";
import { Avatar, Button, Section, Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";

/** Loading / failure / empty row of a community list (the web's LoadingRow, FailedRow, empty line). */
export function CommunityListStatus({ list }: { list: NativeCommunityList }) {
  const { act } = useScreen();
  if (list.status === "failed" && list.failure)
    return (
      <View style={styles.status} accessibilityRole="alert">
        <Text style={styles.statusText}>{list.failure.message}</Text>
        <Button
          label={list.failure.retryLabel}
          tone="secondary"
          disabled={list.failure.retryDisabled}
          onPress={() => act({ type: "directory-retry" })}
        />
      </View>
    );
  return (
    <Text style={[styles.status, styles.statusText]}>
      {list.status === "loading" ? "커뮤니티를 불러오는 중..." : list.emptyText}
    </Text>
  );
}

/** Community cards in a column (the web's communityCardList). */
export function CommunityCards({ items }: { items: NativeCommunity[] }) {
  const { act } = useScreen();
  return (
    <View style={styles.cards}>
      {items.map((community) => (
        <CommunityCard
          key={community.galleryId}
          community={community}
          onOpen={() => act({ type: "open-community", galleryId: community.galleryId })}
          onToggleJoin={() => act({ type: "toggle-join", galleryId: community.galleryId })}
        />
      ))}
    </View>
  );
}

/** Join/leave failure under the lists (the web's MembershipError). */
export function MembershipErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Text style={styles.membershipError} accessibilityRole="alert">
      {message}
    </Text>
  );
}

/** The community tab (the web's CommunityDirectory). */
export function CommunityDirectory({ directory }: { directory: NativeCommunityDirectory }) {
  const { act } = useScreen();
  const { joined, recommended } = directory;
  return (
    <View style={styles.directory}>
      {joined && (
        <Section title="가입한 커뮤니티" onAll={() => act({ type: "open-joined" })}>
          {joined.status === "ready" ? (
            <FlatList
              horizontal
              data={joined.items}
              keyExtractor={(community) => String(community.galleryId)}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.rail}
              accessibilityLabel="가입한 커뮤니티 목록"
              renderItem={({ item }) => <RailCard community={item} />}
            />
          ) : (
            <CommunityListStatus list={joined} />
          )}
        </Section>
      )}
      {recommended && (
        <View style={joined ? styles.recommended : undefined}>
          <Section title="추천 커뮤니티">
            {recommended.status === "ready" ? (
              <CommunityCards items={recommended.items} />
            ) : (
              <CommunityListStatus list={recommended} />
            )}
          </Section>
        </View>
      )}
      <MembershipErrorText message={directory.membershipError} />
    </View>
  );
}

/** The narrow card of the joined rail (the web's CommunityRailCard). */
function RailCard({ community }: { community: NativeCommunity }) {
  const { act, uri } = useScreen();
  return (
    <View style={styles.railCard}>
      <Avatar uri={uri(community.imageUrl)} size={40} />
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`${community.name} 커뮤니티 열기`}
        onPress={() => act({ type: "open-community", galleryId: community.galleryId })}
      >
        <Text style={[type.label, styles.railName]} numberOfLines={2}>
          {community.name}
        </Text>
      </Touchable>
      <Text style={type.muted}>{community.memberLabel}</Text>
      <View style={styles.railJoin}>
        <JoinButton
          community={community}
          onPress={() => act({ type: "toggle-join", galleryId: community.galleryId })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  directory: { paddingTop: 16 },
  recommended: { marginTop: 12 },
  rail: { paddingHorizontal: gutter, gap: 20 },
  railCard: {
    width: 140,
    height: 216,
    padding: 14,
    gap: 4,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  railName: { textAlign: "center", marginTop: 8 },
  railJoin: { marginTop: "auto" },
  cards: { gap: 12 },
  status: { paddingHorizontal: gutter, paddingVertical: 24, alignItems: "center", gap: 12 },
  statusText: { textAlign: "center", color: colors.muted, fontSize: 14, lineHeight: 20 },
  membershipError: {
    marginHorizontal: gutter,
    marginTop: 10,
    color: colors.error,
    fontSize: 14,
    lineHeight: 18,
  },
});
