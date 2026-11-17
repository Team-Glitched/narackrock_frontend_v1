import { ChevronRight } from "lucide-react";
import { preferenceCopy, preferenceRow, preferenceSwitch } from "@/styles/variants";
import { uiLabels } from "@/lib/ui-labels";
import { useAbyssPlaybackPreferences } from "@/features/abyss/playback-preferences";
import { useOperatorAdmin } from "@/features/admin/use-operator-admin";

/** Navigation rows of the settings page, by group. */
export const settingsGroups = [
  {
    title: "계정",
    items: [
      { path: "/profile/edit", label: uiLabels.editProfile, description: "프로필 사진, 이름 및 소개" },
    ],
  },
  {
    title: "음악 및 참여 활동",
    items: [
      { path: "/workspace", label: uiLabels.workspace, description: "작성 중인 음악과 레이어 관리" },
      {
        path: "/submissions",
        label: uiLabels.submissions,
        description: "제출한 레이어와 승인 결과 확인",
      },
      {
        path: "/reviews",
        label: uiLabels.reviewInbox,
        description: "내 음악에 도착한 참여 요청 검토",
      },
    ],
  },
  {
    title: "보관함",
    items: [
      { path: "/saved", label: uiLabels.saved, description: "저장한 게시글과 어비스" },
      { path: "/profile/likes", label: "좋아요한 게시글", description: "좋아요를 누른 게시글 전체 목록" },
      {
        path: "/library",
        label: uiLabels.sourceLibrary,
        description: "제작하거나 저장한 레이어",
      },
    ],
  },
  {
    title: "서비스 안내",
    items: [
      { path: "/privacy", label: "개인정보처리방침", description: "개인정보 수집·이용 및 문의 안내" },
    ],
  },
] as const;

type SettingsGroup = { title: string; items: readonly { path: string; label: string; description: string }[] };

/** Shown only to operator admins. */
const operatorGroup: SettingsGroup = {
  title: "관리",
  items: [{ path: "/admin", label: "운영자 관리", description: "커뮤니티 개설 승인과 신고 처리" }],
};

/** The settings groups for this account; operator admins also get the "관리" group before "서비스 안내". */
export function settingsGroupsFor(operator: boolean): readonly SettingsGroup[] {
  if (!operator) return settingsGroups;
  return [...settingsGroups.slice(0, -1), operatorGroup, ...settingsGroups.slice(-1)];
}

const groupClass =
  "mb-10 [&>h2]:mb-3.5 [&>h2]:text-title [&>h2]:leading-[26px] [&>h2]:font-bold [&>h2]:tracking-[-0.4px] [&>h2]:text-app-fg [&>ul]:m-0 [&>ul]:list-none [&>ul]:p-0 [&_li+li]:border-t [&_li+li]:border-app-surface";

export function SettingsScreen({ onNavigate, onLogout }: {
  onNavigate: (path: string) => void;
  onLogout: () => void;
}) {
  const { muted, setMuted } = useAbyssPlaybackPreferences();
  const groups = settingsGroupsFor(useOperatorAdmin());
  return (
    <section className="scrollbar-none h-full overflow-x-hidden overflow-y-auto px-5 pt-7 pb-10 text-app-fg">
      <h1 className="m-0 mb-8 text-title leading-8 font-bold">설정</h1>
      <section className={groupClass} aria-label="숏폼 재생">
        <h2>숏폼 재생</h2>
        <ul>
          <li>
            <label className={preferenceRow}>
              <span className={preferenceCopy}>
                <strong>숏폼 음소거</strong>
                <small>숏폼 화면 상단의 소리 버튼과 같은 설정입니다.</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                className={preferenceSwitch}
                checked={muted}
                onChange={(event) => setMuted(event.target.checked)}
              />
            </label>
          </li>
        </ul>
      </section>
      {groups.map((group) => (
        <section className={groupClass} key={group.title} aria-label={group.title}>
          <h2>{group.title}</h2>
          <ul>
            {group.items.map((item) => (
              <li key={item.path}>
                <button
                  className={`${preferenceRow} active:rounded-lg active:bg-app-surface [&>svg]:shrink-0`}
                  onClick={() => onNavigate(item.path)}
                >
                  <span className={preferenceCopy}>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                  <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <button
        className="mt-2 block min-h-12 w-full rounded-none border-0 border-t border-solid border-app-surface bg-transparent py-3 text-left text-label leading-6 font-medium text-[#ff8d8d]"
        onClick={onLogout}
      >
        로그아웃
      </button>
    </section>
  );
}
