import { StyleSheet, Text, View } from "react-native";

import { PostRow } from "../../ui/cards";
import { AppHeader } from "../../ui/header";
import { Button } from "../../ui/kit";
import { ScreenList } from "../../ui/screen";
import { useScreen } from "../../ui/screen-context";
import { gutter, type } from "../../ui/theme";
import type { ScreenProps } from "../types";
import { CenterMessage, Notice } from "./parts";

/** The web liked posts page (src/features/profile/liked-posts-screen.tsx). */
export function LikedPostsScreen({ model, header }: ScreenProps<"profile-likes">) {
  const { act } = useScreen();
  return (
    <>
      {header && <AppHeader header={header} />}
      <ScreenList
        data={model.posts}
        keyExtractor={(post) => String(post.postId)}
        hasMore={model.more !== null}
        busy={model.more?.busy ?? false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.top}>
            {model.posts.length > 0 && (
              <Text style={[type.title, styles.title]} accessibilityRole="header">
                좋아요한 게시글
              </Text>
            )}
            {model.status === "loading" && <CenterMessage>목록을 불러오는 중...</CenterMessage>}
            {model.error && (
              <CenterMessage
                action={
                  <Button
                    label="다시 시도"
                    tone="secondary"
                    onPress={() => act({ type: "retry" })}
                  />
                }
              >
                {model.error}
              </CenterMessage>
            )}
            {model.forbidden && (
              <Notice tone="muted">일부 게시글은 접근 권한이 없어 표시할 수 없습니다.</Notice>
            )}
          </View>
        }
        renderItem={({ item: post }) => (
          <PostRow
            tall
            post={post}
            onOpen={() => act({ type: "open-post", postId: post.postId })}
          />
        )}
        ListFooterComponent={
          <>
            {model.empty && (
              <CenterMessage
                action={
                  <Button
                    label="새로고침"
                    tone="secondary"
                    disabled={model.empty.disabled}
                    onPress={() => act({ type: "reload" })}
                  />
                }
              >
                {model.empty.message}
              </CenterMessage>
            )}
            {model.failed && (
              <CenterMessage
                action={
                  <Button
                    label="실패한 게시글 다시 시도"
                    tone="secondary"
                    disabled={model.failed.disabled}
                    onPress={() => act({ type: "retry-failed" })}
                  />
                }
              >
                {`${model.failed.count}개 게시글을 불러오지 못했습니다.`}
              </CenterMessage>
            )}
            {model.more && (
              <Button
                label={model.more.busy ? "불러오는 중..." : "더보기"}
                tone="secondary"
                disabled={model.more.busy}
                style={styles.more}
                onPress={() => act({ type: "more" })}
              />
            )}
          </>
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: { gap: 16 },
  top: { gap: 16 },
  title: { paddingHorizontal: gutter },
  more: { marginHorizontal: gutter, marginVertical: 8, borderRadius: 999 },
});
