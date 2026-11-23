import { useGalleryPosts } from "@/features/community/use-gallery-posts";
import { nativePost } from "@/features/navigation/native-models";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import { uiLabels } from "@/lib/ui-labels";
import type { NativePostList } from "@/lib/native-screens";

/** In the app the popular posts page (PostsScreen) is drawn natively (native/screens/posts.tsx). */
export function NativePostsBridge({
  onOpenPost,
  onCreate,
  onSearch,
  onBack,
}: {
  onOpenPost: (postId: number) => void;
  onCreate: () => void;
  onSearch: () => void;
  onBack: () => void;
}) {
  const posts = useGalleryPosts("popular");
  const model: NativePostList = {
    title: uiLabels.popularPosts,
    createLabel: "글쓰기",
    list: {
      status: posts.status,
      items: posts.status === "ready" ? posts.posts.map(nativePost) : [],
      hasMore: posts.hasMore,
      appending: posts.appending,
      appendFailed: posts.appendFailed,
    },
  };
  return useNativeScreen("posts", model, {
    header: { left: "back", actions: ["notifications", "chat", "search", "account"] },
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "open-post":
          return onOpenPost(action.postId);
        case "create":
          return onCreate();
        case "more":
          return posts.loadMore();
      }
    },
  });
}
