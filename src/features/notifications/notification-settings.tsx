import { useQuery } from "@tanstack/react-query";
import type { NotificationPreferences } from "@/lib/api/notifications";
import { notificationPreferencesQuery, useNotificationMutations } from "./notification-queries";
const options: { key: keyof NotificationPreferences; title: string; description: string }[] = [
  { key: "reactions", title: "좋아요", description: "내 콘텐츠와 댓글에 받은 좋아요" },
  {
    key: "followingContent",
    title: "팔로우한 창작자의 새 콘텐츠",
    description: "새로 공개된 음악과 오픈소스",
  },
  {
    key: "communityPosts",
    title: "구독 커뮤니티의 새 글",
    description: "내가 가입한 커뮤니티의 새 게시글",
  },
  {
    key: "sourceUsage",
    title: "내 오픈소스 사용",
    description: "다른 사람의 작곡에 사용되거나 사용한 곡이 공개됐을 때",
  },
];
export function NotificationSettings({ userId }: { userId: number }) {
  const query = useQuery(notificationPreferencesQuery(userId));
  const { preferences } = useNotificationMutations();
  return (
    <section
      className="mb-5 rounded-2xl border border-white/10 bg-white/[0.03] p-4"
      aria-label="알림 수신 설정"
    >
      <h2 className="mb-1 text-label font-semibold">알림 수신 설정</h2>
      <p className="mb-3 text-caption leading-5 text-app-muted">
        요청·처리 결과와 댓글, 운영 안내는 항상 알립니다.
      </p>
      {query.isPending && <p role="status">설정을 불러오는 중...</p>}
      {query.isError && (
        <p role="alert">
          설정을 불러오지 못했습니다.{" "}
          <button onClick={() => void query.refetch()}>다시 시도</button>
        </p>
      )}
      {query.data &&
        options.map(({ key, title, description }) => (
          <label
            key={key}
            className="flex cursor-pointer items-center gap-3 border-t border-white/5 py-3"
          >
            <span className="flex-1">
              <strong className="block text-caption font-medium">{title}</strong>
              <small className="mt-1 block text-[11px] leading-4 text-app-muted">
                {description}
              </small>
            </span>
            <input
              type="checkbox"
              className="size-4 accent-[#6500ff]"
              checked={query.data[key]}
              disabled={preferences.isPending}
              onChange={(e) => preferences.mutate({ ...query.data!, [key]: e.target.checked })}
            />
          </label>
        ))}
      {preferences.isPending && (
        <p role="status" className="text-caption text-app-muted">
          저장 중...
        </p>
      )}
      {preferences.isSuccess && (
        <p role="status" className="text-caption text-app-muted">
          설정을 저장했습니다.
        </p>
      )}
      {preferences.isError && (
        <p role="alert" className="text-caption text-red-300">
          설정을 저장하지 못했습니다. 다시 선택해 주세요.
        </p>
      )}
    </section>
  );
}
