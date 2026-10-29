import { logout } from "@/lib/api/auth";
import type { Navigate } from "@/features/navigation/types";
import { ChevronRight } from "lucide-react";
import { uiLabels } from "@/lib/ui-labels";
import "./settings.css";

const groups = [
  { title: "계정", items: [
    { view: "edit", label: uiLabels.editProfile, description: "프로필 사진, 이름 및 소개" },
  ] },
  { title: "음악 및 참여 활동", items: [
    { view: "workspace", label: uiLabels.workspace, description: "작성 중인 음악과 레이어 관리" },
    { view: "submissions", label: uiLabels.submissions, description: "제출한 레이어와 승인 결과 확인" },
    { view: "reviewInbox", label: uiLabels.reviewInbox, description: "내 음악에 도착한 참여 요청 검토" },
  ] },
  { title: "보관함", items: [
    { view: "saved", label: uiLabels.saved, description: "저장한 게시글과 음악" },
    { view: "sourceLibrary", label: uiLabels.sourceLibrary, description: "제작하거나 저장한 레이어" },
  ] },
] as const;

export function SettingsScreen({ go }: { go: Navigate }) {
  return <section className="settings-view scroll-content">
    <h1>설정</h1>
    {groups.map(group => <section className="settings-group" key={group.title} aria-label={group.title}>
      <h2>{group.title}</h2>
      <ul>{group.items.map(item => <li key={item.view}><button className="settings-row" onClick={() => go(item.view)}>
        <span className="settings-row-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
        <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
      </button></li>)}</ul>
    </section>)}
    <section className="settings-group" aria-label="서비스 정보"><h2>서비스 정보</h2><ul>
      <li><a className="settings-row" href="/privacy"><span className="settings-row-copy"><strong>개인정보처리방침</strong></span><ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" /></a></li>
    </ul></section>
    <button className="profile-logout" onClick={logout}>로그아웃</button>
  </section>;
}
