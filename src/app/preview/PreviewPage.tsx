import { sharedStyles } from "@/styles/shared.styles";
import type { View } from "@/features/navigation/types";
import App from "../App";

/** Same app, navigation, editor and API contracts; only the data source is local. */
export default function PreviewPage() {
  return <div className={sharedStyles.v3Preview}><App /><details className={sharedStyles.previewQuickNav}><summary>화면 바로가기</summary><p>로그인 없이 예시 데이터로 체험할 수 있어요.</p><div>{([{view:"home",label:"홈"},{view:"abyss",label:"음악 듣기"},{view:"studio",label:"곡 만들기"},{view:"social",label:"게시글"},{view:"community",label:"커뮤니티"},{view:"friends",label:"친구"},{view:"profile",label:"프로필"},{view:"edit",label:"프로필 편집"},{view:"saved",label:"저장 목록"},{view:"admin",label:"관리자"},{view:"communityAdmin",label:"커뮤니티 관리"},{view:"settings",label:"설정"}] as {view:View;label:string}[]).map(item => <button key={item.view} onClick={event => { window.dispatchEvent(new CustomEvent("narackrock-preview-navigate",{detail:item.view})); event.currentTarget.closest("details")?.removeAttribute("open"); }}>{item.label}</button>)}</div><small>관리자 처리는 화면 체험용입니다.</small></details><span className={sharedStyles.previewModeLabel}>V3 미리보기 · 예시 데이터</span></div>;
}
