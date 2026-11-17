import type { ReactNode } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import type {
  NativeFailure,
  NativeFollowRequests,
  NativeFriend,
  NativeFriendsAction,
  NativeMutualFriends,
  NativeRecommendedPeople,
} from "../../../src/lib/native-screens";
import { Avatar, Button, Touchable } from "../../ui/kit";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";

/** The web's SectionTitle inside a friends section (no side padding of its own). */
function SectionHead({ title, onAll }: { title: string; onAll?: () => void }) {
  return (
    <View style={styles.head}>
      <Text style={[type.title, styles.flex]} numberOfLines={1} accessibilityRole="header">
        {title}
      </Text>
      {onAll && (
        <Touchable
          accessibilityRole="button"
          accessibilityLabel={`${title} 모두보기`}
          hitSlop={8}
          onPress={onAll}
        >
          <Text style={styles.all}>모두보기</Text>
        </Touchable>
      )}
    </View>
  );
}

function Line({ children, tone = "muted" }: { children: string; tone?: "muted" | "fg" }) {
  return <Text style={[styles.line, tone === "fg" && { color: colors.fg }]}>{children}</Text>;
}

function Failure({ failure, retry }: { failure: NativeFailure; retry: NativeFriendsAction }) {
  const { act } = useScreen();
  return (
    <View style={styles.failure} accessibilityRole="alert">
      <Text style={styles.failureText}>{failure.message}</Text>
      <Button
        label={failure.retryLabel}
        tone="secondary"
        disabled={failure.retryDisabled}
        style={styles.compact}
        onPress={() => act(retry)}
      />
    </View>
  );
}

/** A person row (the web's PersonLink): avatar, nickname, instrument, then the row's buttons. */
function PersonRow({ person, children }: { person: NativeFriend; children: ReactNode }) {
  const { act, uri } = useScreen();
  return (
    <View style={styles.person}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={`${person.nickname} 프로필 열기`}
        style={styles.personLink}
        onPress={() => act({ type: "open-profile", userId: person.userId })}
      >
        <Avatar uri={uri(person.profileImageUrl)} size={40} />
        <View style={styles.flex}>
          <Text style={type.label} numberOfLines={1}>
            {person.nickname}
          </Text>
          {person.instrument !== "" && (
            <Text style={type.muted} numberOfLines={1}>
              {person.instrument}
            </Text>
          )}
        </View>
      </Touchable>
      {children}
    </View>
  );
}

function ChatButton({ person }: { person: NativeFriend }) {
  const { act } = useScreen();
  return (
    <Button
      label="채팅"
      style={styles.compact}
      onPress={() => act({ type: "open-chat", userId: person.userId })}
    />
  );
}

/** 맞팔로우: a rail of cards on the friends tab, a list on its own page. */
export function MutualFriends({ mutual, full }: { mutual: NativeMutualFriends; full: boolean }) {
  const { act, uri } = useScreen();
  return (
    <View style={styles.section} accessibilityLabel="맞팔로우">
      <SectionHead
        title="맞팔로우"
        onAll={full ? undefined : () => act({ type: "open-friends-list", kind: "mutual" })}
      />
      {mutual.loading && <Line>{mutual.loading}</Line>}
      {mutual.failure && <Failure failure={mutual.failure} retry={{ type: "mutual-retry" }} />}
      {mutual.empty && <Line>{mutual.empty}</Line>}
      {full ? (
        <View style={styles.people}>
          {mutual.people.map((person) => (
            <PersonRow key={person.userId} person={person}>
              <ChatButton person={person} />
            </PersonRow>
          ))}
        </View>
      ) : (
        <FlatList
          horizontal
          data={mutual.people}
          keyExtractor={(person) => String(person.userId)}
          showsHorizontalScrollIndicator={false}
          style={styles.rail}
          contentContainerStyle={styles.railContent}
          renderItem={({ item: person }) => (
            <View style={styles.card}>
              <Touchable
                accessibilityRole="button"
                accessibilityLabel={`${person.nickname} 프로필`}
                style={styles.identity}
                onPress={() => act({ type: "open-profile", userId: person.userId })}
              >
                <Avatar uri={uri(person.profileImageUrl)} size={64} />
                <Text style={styles.cardName} numberOfLines={1}>
                  {person.nickname}
                </Text>
                <Text style={type.muted} numberOfLines={1}>
                  {person.instrument}
                </Text>
              </Touchable>
              <ChatButton person={person} />
            </View>
          )}
        />
      )}
    </View>
  );
}

/** 팔로우 추천 with the follow buttons; the full list has "더보기". */
export function RecommendedPeople({
  recommendations,
  full,
}: {
  recommendations: NativeRecommendedPeople;
  full: boolean;
}) {
  const { act } = useScreen();
  const { failure } = recommendations;
  return (
    <View style={styles.section} accessibilityLabel="팔로우 추천">
      <SectionHead
        title="팔로우 추천"
        onAll={full ? undefined : () => act({ type: "open-friends-list", kind: "recommendations" })}
      />
      {recommendations.checking && <Line>{recommendations.checking}</Line>}
      {recommendations.outgoingFailure && (
        <Failure failure={recommendations.outgoingFailure} retry={{ type: "outgoing-retry" }} />
      )}
      {failure && (
        <View style={styles.failure} accessibilityRole="alert">
          <Text style={styles.failureText}>{failure.message}</Text>
          {failure.stale && (
            <Text style={styles.failureText}>
              목록이 최신 상태가 아닙니다. 동기화 후 더 불러올 수 있습니다.
            </Text>
          )}
          <Button
            label={failure.retryLabel}
            tone="secondary"
            disabled={failure.retryDisabled}
            style={styles.compact}
            onPress={() => act({ type: "recommendations-retry" })}
          />
        </View>
      )}
      {recommendations.notice && <Line tone="fg">{recommendations.notice}</Line>}
      {recommendations.loading && <Line>{recommendations.loading}</Line>}
      {recommendations.empty && <Line>{recommendations.empty}</Line>}
      <View style={styles.people}>
        {recommendations.people.map((row) => (
          <PersonRow key={row.person.userId} person={row.person}>
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={row.accessibilityLabel}
              accessibilityState={{
                disabled: row.disabled,
                selected: row.pressed ?? undefined,
              }}
              disabled={row.disabled}
              style={[
                styles.follow,
                row.tone === "secondary" && styles.followSecondary,
                row.disabled && styles.disabled,
              ]}
              onPress={() => act({ type: "follow", userId: row.person.userId })}
            >
              <Text style={styles.followText}>{row.label}</Text>
            </Touchable>
          </PersonRow>
        ))}
      </View>
      {recommendations.more && (
        <Button
          label="더보기"
          tone="secondary"
          disabled={recommendations.more.disabled}
          onPress={() => act({ type: "more" })}
        />
      )}
    </View>
  );
}

/** 팔로우 요청 with 수락/거절. */
export function FollowRequests({
  requests,
  full,
}: {
  requests: NativeFollowRequests;
  full: boolean;
}) {
  const { act } = useScreen();
  return (
    <View style={styles.section} accessibilityLabel="팔로우 요청">
      <SectionHead
        title="팔로우 요청"
        onAll={full ? undefined : () => act({ type: "open-friends-list", kind: "requests" })}
      />
      {requests.notice && <Line tone="fg">{requests.notice}</Line>}
      {requests.loading && <Line>{requests.loading}</Line>}
      {requests.failure && (
        <Failure failure={requests.failure} retry={{ type: "requests-retry" }} />
      )}
      {requests.empty && <Line>{requests.empty}</Line>}
      <View style={styles.people}>
        {requests.requests.map(({ requestId, person }) => (
          <PersonRow key={requestId} person={person}>
            <Button
              label="수락"
              disabled={requests.busy}
              style={styles.compact}
              onPress={() => act({ type: "review-request", requestId, decision: "accept" })}
            />
            <Button
              label="거절"
              tone="secondary"
              disabled={requests.busy}
              style={styles.compact}
              onPress={() => act({ type: "review-request", requestId, decision: "reject" })}
            />
          </PersonRow>
        ))}
      </View>
    </View>
  );
}

/** The web's SignInRequired: the message and a "로그인" button opening the login prompt. */
export function SignInRequired({ message }: { message: string }) {
  const { act } = useScreen();
  return (
    <View style={styles.signIn}>
      <Text style={styles.signInText}>{message}</Text>
      <Button label="로그인" onPress={() => act({ type: "sign-in" })} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { paddingHorizontal: gutter, gap: 16 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 26 },
  all: { color: colors.muted, fontSize: 16, lineHeight: 20, fontWeight: "500" },
  line: { color: colors.muted, fontSize: 14, lineHeight: 24 },
  failure: { gap: 8, alignItems: "flex-start" },
  failureText: { color: colors.error, fontSize: 14, lineHeight: 20 },
  compact: { minHeight: 36, paddingHorizontal: 14 },
  people: { gap: 12 },
  person: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  personLink: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  rail: { marginHorizontal: -gutter },
  railContent: { paddingHorizontal: gutter, gap: 20 },
  card: {
    width: 140,
    minHeight: 216,
    padding: 10,
    gap: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "space-between",
  },
  identity: { alignItems: "center", gap: 4 },
  cardName: { color: colors.fg, fontSize: 16, lineHeight: 20, fontWeight: "700", marginTop: 8 },
  follow: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.primary,
  },
  followSecondary: { backgroundColor: colors.surface },
  followText: { color: colors.fg, fontSize: 15, fontWeight: "600" },
  disabled: { opacity: 0.4 },
  signIn: { paddingHorizontal: gutter, paddingVertical: 48, alignItems: "center", gap: 16 },
  signInText: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: "center" },
});
