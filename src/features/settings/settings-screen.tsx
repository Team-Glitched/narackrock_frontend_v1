import { ChevronRight } from "lucide-react";
import { uiLabels } from "@/lib/ui-labels";
import { useAbyssPlaybackPreferences } from "@/features/abyss/playback-preferences";

const groups = [
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

const rowClass =
  "flex min-h-16 w-full items-center justify-between gap-4 py-3 text-left text-app-fg no-underline active:rounded-lg active:bg-app-surface [&>svg]:shrink-0";
const copyClass =
  "flex min-w-0 flex-col gap-2 [&>strong]:text-label [&>strong]:leading-6 [&>strong]:font-medium [&>strong]:[overflow-wrap:anywhere] [&>small]:text-caption [&>small]:leading-[18px] [&>small]:font-normal [&>small]:text-app-muted";
const groupClass =
  "mb-6 [&>h2]:mb-2 [&>h2]:text-caption [&>h2]:leading-[18px] [&>h2]:font-semibold [&>h2]:text-app-muted [&>ul]:m-0 [&>ul]:list-none [&>ul]:p-0 [&_li+li]:border-t [&_li+li]:border-app-surface";
const switchRowClass = "flex min-h-16 w-full items-center justify-between gap-4 py-3 text-left text-app-fg";
const switchClass = "size-6 flex-none accent-app-primary";

export function SettingsScreen({ onNavigate, onLogout }: {
  onNavigate: (path: string) => void;
  onLogout: () => void;
}) {
  const { muted, setMuted } = useAbyssPlaybackPreferences();
  return (
    <section className="scrollbar-none h-full overflow-x-hidden overflow-y-auto px-5 pt-6 pb-8 text-app-fg">
      <h1 className="m-0 mb-7 text-title leading-8 font-bold">설정</h1>
      <section className={groupClass} aria-label="숏폼 재생">
        <h2>숏폼 재생</h2>
        <ul>
          <li>
            <label className={switchRowClass}>
              <span className={copyClass}>
                <strong>숏폼 음소거</strong>
                <small>숏폼 화면 상단의 소리 버튼과 같은 설정입니다.</small>
              </span>
              <input
                type="checkbox"
                role="switch"
                className={switchClass}
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
                <button className={rowClass} onClick={() => onNavigate(item.path)}>
                  <span className={copyClass}>
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
