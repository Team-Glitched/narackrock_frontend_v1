import { StyleSheet, Text, View } from "react-native";

import type { NativeFeed, NativeFriends, NativeSocialTab } from "../../../src/lib/native-screens";
import { Fab } from "../../ui/fab";
import { AppHeader } from "../../ui/header";
import { Touchable } from "../../ui/kit";
import { ScreenList, ScreenScroll } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { colors, gutter } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { CommunityDirectory } from "./directory";
import { FeedFooter, FeedPostCard, FeedStatus, useFeedViewability } from "./feed";
import { FollowRequests, MutualFriends, RecommendedPeople, SignInRequired } from "./friends";

const tabs: { value: NativeSocialTab; label: string }[] = [
  { value: "posts", label: "게시글" },
  { value: "community", label: "커뮤니티" },
  { value: "friends", label: "친구" },
];

/** The web's "소셜 메뉴" tabs (communityTabs): buttons with a pressed state, the active one bold. */
function SocialTabs({ tab }: { tab: NativeSocialTab }) {
  const { act } = useScreen();
  return (
    <View style={styles.tabs} accessibilityLabel="소셜 메뉴">
      {tabs.map((item) => {
        const selected = item.value === tab;
        return (
          <Touchable
            key={item.value}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={[styles.tab, selected && styles.tabSelected]}
            onPress={() => act({ type: "tab", tab: item.value })}
          >
            <Text style={[styles.tabText, selected && styles.tabTextSelected]}>{item.label}</Text>
          </Touchable>
        );
      })}
    </View>
  );
}

/** /social, /communities and /friends (the web's CommunityScreen). */
export function SocialScreen({ model, header }: ScreenProps<"social">) {
  const { act } = useScreen();
  return (
    <>
      {header && <AppHeader header={header} onLogo={() => act({ type: "home" })} />}
      <SocialTabs tab={model.tab} />
      {model.posts ? (
        <PostsTab feed={model.posts} />
      ) : model.communities ? (
        <ScreenScroll fab={model.create !== null}>
          <CommunityDirectory directory={model.communities} />
        </ScreenScroll>
      ) : model.friends ? (
        <FriendsTab friends={model.friends} />
      ) : null}
      {model.create && <Fab label={model.create.label} onPress={() => act({ type: "create" })} />}
    </>
  );
}

function PostsTab({ feed }: { feed: NativeFeed }) {
  const viewability = useFeedViewability(feed);
  return (
    <ScreenList
      data={feed.items}
      keyExtractor={(post) => String(post.postId)}
      hasMore={feed.autoMore && feed.hasMore}
      busy={feed.appending || feed.appendFailed}
      fab
      {...viewability}
      ListEmptyComponent={<FeedStatus feed={feed} />}
      renderItem={({ item }) => <FeedPostCard post={item} />}
      ListFooterComponent={<FeedFooter feed={feed} />}
    />
  );
}

function FriendsTab({ friends }: { friends: NativeFriends }) {
  return (
    <ScreenScroll>
      {friends.signedIn ? (
        <View style={styles.friends}>
          <MutualFriends mutual={friends.mutual} full={false} />
          <RecommendedPeople recommendations={friends.recommendations} full={false} />
          <FollowRequests requests={friends.requests} full={false} />
        </View>
      ) : (
        <SignInRequired message={friends.message} />
      )}
    </ScreenScroll>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: "row",
    height: 40,
    paddingHorizontal: gutter,
    borderBottomWidth: 1,
    borderBottomColor: colors.surface,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabSelected: { borderBottomColor: colors.primary },
  tabText: { color: "#d7dce2", fontSize: 14, lineHeight: 20, fontWeight: "500" },
  tabTextSelected: { color: colors.fg, fontWeight: "600" },
  friends: { gap: 44, paddingTop: 16, paddingBottom: 16 },
});
