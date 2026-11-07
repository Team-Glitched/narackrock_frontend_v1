import { useQuery } from "@tanstack/react-query";
import { useCurrentUserId } from "@/features/auth/use-current-user";
import { galleriesQuery } from "@/features/community/community-queries";
import type { GalleryListItem } from "@/lib/api/contracts";

export type GalleriesState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; galleries: GalleryListItem[] };

/**
 * 전체 갤러리 목록. 비로그인도 볼 수 있고 페이지네이션 없이 전량이 온다.
 *
 * 가입 목록을 따로 받지 않는 이유: 전량이 오므로 `구독한 갤러리 ⊆ 전체 갤러리`가 보장된다.
 * 가입 여부는 CommunityMembershipProvider가 들고 있는 id 집합으로 갈라 쓰면 되고,
 * 그러면 목록 호출이 화면당 한 번으로 끝난다.
 *
 * 구독자 수는 서버 집계라 가입/탈퇴가 반영되면 달라진다. CommunityMembershipProvider가 그때
 * 이 목록(`galleryKeys.list`)을 무효화해 다시 받게 한다.
 */
export function useGalleries(): GalleriesState & { refetch: () => void } {
  const userId = useCurrentUserId();
  const { data, isError, refetch } = useQuery(galleriesQuery(userId));
  const retry = () => void refetch();
  if (data) return { status: "ready", galleries: data, refetch: retry };
  return { status: isError ? "error" : "loading", refetch: retry };
}
