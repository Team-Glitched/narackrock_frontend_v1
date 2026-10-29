import { Outlet, useLocation, useNavigate } from "react-router";
import { appPath, viewPath } from "@/features/navigation/paths";
import type { View } from "@/features/navigation/types";
import { sharedStyles } from "@/styles/shared.styles";

const shortcuts: { view: View; label: string }[] = [
  { view: "home", label: "홈" }, { view: "abyss", label: "음악 듣기" },
  { view: "studio", label: "곡 만들기" }, { view: "social", label: "게시글" },
  { view: "community", label: "커뮤니티" }, { view: "friends", label: "친구" },
  { view: "profile", label: "프로필" }, { view: "edit", label: "프로필 편집" },
  { view: "saved", label: "저장 목록" }, { view: "admin", label: "관리자" },
  { view: "communityAdmin", label: "커뮤니티 관리" }, { view: "settings", label: "설정" },
];

/** Preview shares the real page routes under an isolated URL prefix. */
export default function PreviewPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.pathname + location.search;
  return <div className="v3-preview">
    <Outlet />
    <details className={sharedStyles.previewQuickNav}>
      <summary>화면 바로가기</summary><p>로그인 없이 예시 데이터로 체험할 수 있어요.</p>
      <div>{shortcuts.map(item => <button key={item.view} onClick={event => {
        navigate(appPath(viewPath(item.view), true), { state: { from, studioFrom: item.view === "studio" ? from : undefined, studioIndex: item.view === "studio" ? window.history.state?.idx : undefined } });
        event.currentTarget.closest("details")?.removeAttribute("open");
      }}>{item.label}</button>)}</div>
      <small>관리자 처리는 화면 체험용입니다.</small>
    </details>
    <span className={sharedStyles.previewModeLabel}>V3 미리보기 · 예시 데이터</span>
  </div>;
}
