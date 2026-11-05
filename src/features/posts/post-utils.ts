import { formatDistanceToNow } from "date-fns";
import { ko } from "date-fns/locale";
import { ApiError } from "@/lib/api/client";

export function postError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "로그인이 필요합니다. 로그인 후 다시 시도해주세요.";
    if (error.status === 403)
      return "이 작업을 수행할 권한이 없습니다. 계정 상태와 작성자를 확인해주세요.";
    if (error.errorCode === "GALLERY_NOT_FOUND")
      return "게시글을 등록할 커뮤니티를 찾을 수 없습니다. 잠시 후 다시 시도해주세요.";
    if (error.status === 404) return "게시글을 찾을 수 없습니다. 목록을 새로고침해주세요.";
  }
  return "요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.";
}

export function relativeTime(createdAt: string): string {
  return formatDistanceToNow(new Date(createdAt), { addSuffix: true, locale: ko });
}
