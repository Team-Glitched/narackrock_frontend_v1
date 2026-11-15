import { StyleSheet, Text } from "react-native";

import { postStatus, PostRow } from "../ui/cards";
import { Fab } from "../ui/fab";
import { AppHeader } from "../ui/header";
import { PagingFooter, Status } from "../ui/kit";
import { ScreenList } from "../ui/screen";
import { useScreen } from "../ui/screen-context";
import { gutter, type } from "../ui/theme";
import type { ScreenProps } from "./types";

/** The web popular posts page (src/features/posts/post-list.tsx PostsScreen). */
export function PostsScreen({ model, header }: ScreenProps<"posts">) {
  const { act } = useScreen();
  const { list } = model;
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenList
        data={list.items}
        keyExtractor={(post) => String(post.postId)}
        hasMore={list.hasMore}
        busy={list.appending || list.appendFailed}
        fab
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={[type.title, styles.title]} accessibilityRole="header">
            {model.title}
          </Text>
        }
        ListEmptyComponent={
          <Status>{postStatus[list.status === "ready" ? "empty" : list.status]}</Status>
        }
        renderItem={({ item: post }) => (
          <PostRow
            tall
            post={post}
            onOpen={() => act({ type: "open-post", postId: post.postId })}
          />
        )}
        ListFooterComponent={
          <PagingFooter
            appending={list.appending}
            appendFailed={list.appendFailed}
            onMore={() => act({ type: "more" })}
          />
        }
      />
      <Fab label={model.createLabel} onPress={() => act({ type: "create" })} />
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: 16 },
  title: { paddingHorizontal: gutter },
});
