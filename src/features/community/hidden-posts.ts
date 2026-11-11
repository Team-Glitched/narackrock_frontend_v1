import { useCurrentUserId } from "@/features/auth/use-current-user";
import { useHiddenIds } from "@/lib/browser/hidden-ids";

/** Hiding is shared by all post surfaces, isolated by account. */
export function useHiddenPosts() {
  const userId = useCurrentUserId();
  return useHiddenIds(`narackrock.hidden-posts.${userId ?? "guest"}`);
}
