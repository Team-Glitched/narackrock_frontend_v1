import { StyleSheet, Text, View } from "react-native";

import AdminToolIcon from "../../../public/figma/admin-tool.svg";
import { JoinButton } from "../../ui/community";
import { Fab } from "../../ui/fab";
import { AppHeader } from "../../ui/header";
import { Avatar, Button, Touchable } from "../../ui/kit";
import { ScreenList, ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter, type } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { CommunityCards, CommunityListStatus, MembershipErrorText } from "./directory";
import { FeedFooter, FeedPostCard, FeedStatus, useFeedViewability } from "./feed";
import { FollowRequests, MutualFriends, RecommendedPeople, SignInRequired } from "./friends";

/** /communities/:galleryId (the web's CommunityDetailScreen). */
export function CommunityDetailScreen({ model, header }: ScreenProps<"social-community">) {
  const { act } = useScreen();
  const { feed } = model;
  const viewability = useFeedViewability(feed);
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenList
        data={feed.status === "ready" ? feed.items : []}
        keyExtractor={(post) => String(post.postId)}
        hasMore={feed.autoMore && feed.hasMore}
        busy={feed.appending || feed.appendFailed}
        fab={model.createLabel !== null}
        {...viewability}
        ListHeaderComponent={<CommunityInfo model={model} />}
        ListEmptyComponent={<FeedStatus feed={feed} />}
        renderItem={({ item }) => <FeedPostCard post={item} />}
        ListFooterComponent={<FeedFooter feed={feed} />}
      />
      {model.createLabel !== null && (
        <Fab label={model.createLabel} onPress={() => act({ type: "create" })} />
      )}
    </>
  );
}

function CommunityInfo({ model }: { model: ScreenProps<"social-community">["model"] }) {
  const { act, uri } = useScreen();
  const { community, membershipError } = model;
  return (
    <View>
      <View style={[styles.banner, model.manage && styles.bannerOwned]}>
        {model.manage && (
          <Touchable
            accessibilityRole="button"
            accessibilityLabel="관리자 페이지"
            hitSlop={9}
            style={styles.manage}
            onPress={() => act({ type: "manage" })}
          >
            <AdminToolIcon width={18} height={18} />
            <Text style={styles.manageText}>관리자 페이지</Text>
          </Touchable>
        )}
      </View>
      <View
        style={[styles.info, model.manage && styles.infoOwned]}
        accessibilityLabel="커뮤니티 소개"
      >
        <View style={styles.heading}>
          <Avatar uri={uri(community.imageUrl)} size={40} />
          <View style={styles.flex}>
            <Text style={type.title} accessibilityRole="header">
              {community.name}
            </Text>
            <Text style={[type.muted, styles.members]}>{community.memberLabel}</Text>
          </View>
          <JoinButton community={community} onPress={() => act({ type: "toggle-join" })} />
        </View>
        {community.description !== "" && (
          <Text style={[type.muted, styles.description]}>{community.description}</Text>
        )}
        {membershipError && (
          <View style={styles.membershipError} accessibilityRole="alert">
            <Text style={styles.membershipErrorText}>{membershipError.message}</Text>
            {membershipError.retry && (
              <Button
                label="다시 시도"
                tone="secondary"
                disabled={membershipError.retryDisabled}
                style={styles.compact}
                onPress={() => act({ type: "membership-retry" })}
              />
            )}
          </View>
        )}
      </View>
    </View>
  );
}

/** A page whose body is only a status line (loading, not found, invalid address). */
export function PageStateScreen({ model, header }: ScreenProps<"social-page-state">) {
  const { act } = useScreen();
  return (
    <>
      {header && <AppHeader header={header} />}
      <View style={styles.pageState} accessibilityRole={model.tone === "error" ? "alert" : "text"}>
        <Text style={[styles.pageStateText, model.tone === "error" && { color: colors.error }]}>
          {model.message}
        </Text>
      </View>
      {model.createLabel !== null && (
        <Fab label={model.createLabel} onPress={() => act({ type: "create" })} />
      )}
    </>
  );
}

/** /communities/joined (the web's JoinedCommunitiesScreen). */
export function JoinedScreen({ model, header }: ScreenProps<"social-joined">) {
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenScroll>
        <Text style={styles.joinedTitle} accessibilityRole="header">
          {model.title}
        </Text>
        {model.joined.status === "ready" ? (
          <CommunityCards items={model.joined.items} />
        ) : (
          <CommunityListStatus list={model.joined} />
        )}
        <MembershipErrorText message={model.membershipError} />
      </ScreenScroll>
    </>
  );
}

/** /friends/:list (the web's FriendsListScreen). */
export function FriendsListScreen({ model, header }: ScreenProps<"social-friends-list">) {
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenScroll>
        {!model.signedIn ? (
          <SignInRequired message={model.message} />
        ) : (
          <View style={styles.friendsList}>
            {model.kind === "mutual" ? (
              <MutualFriends mutual={model.mutual} full />
            ) : model.kind === "requests" ? (
              <FollowRequests requests={model.requests} full />
            ) : (
              <RecommendedPeople recommendations={model.recommendations} full />
            )}
          </View>
        )}
      </ScreenScroll>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  banner: { height: 90, backgroundColor: "#383838" },
  bannerOwned: {
    backgroundColor: "#8f8f8f",
    alignItems: "flex-end",
    padding: 10,
  },
  manage: {
    minHeight: 26,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  manageText: { color: colors.fg, fontSize: 12, lineHeight: 16 },
  info: {
    marginHorizontal: gutter,
    marginBottom: 8,
    paddingTop: 6,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoOwned: { marginTop: 5, paddingTop: 0, marginBottom: 10, borderBottomColor: colors.surface },
  heading: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  members: { marginTop: 4 },
  description: { marginTop: 12 },
  membershipError: { marginTop: 10, gap: 8, alignItems: "flex-start" },
  membershipErrorText: { color: colors.error, fontSize: 14, lineHeight: 18 },
  compact: { minHeight: 36, paddingHorizontal: 14 },
  pageState: {
    flex: 1,
    minHeight: 280,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: gutter,
    paddingVertical: 48,
  },
  pageStateText: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: "center" },
  joinedTitle: {
    marginHorizontal: gutter,
    marginBottom: 14,
    color: colors.fg,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "700",
  },
  friendsList: { paddingTop: 16 },
});
