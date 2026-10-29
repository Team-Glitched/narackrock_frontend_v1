import { useRef, useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";

import { AnchoredActionsMenu } from "@/components/app/dialog";
import { CommunityDetailScreen } from "@/features/screens/community-detail";
import { galleryToCommunity, type Community } from "@/features/screens/community-card";
import { useGalleries } from "@/hooks/use-galleries";
import { isPreviewMode } from "@/features/preview/preview-mode";
import { getPreviewCommunityMembers, moderatePreviewCommunityMember, type PreviewCommunityMember } from "@/features/preview/demo-api";
import { canManageCommunityMember, isCommunityOwner } from "./permissions";
import "./community-admin.css";
import { MemberActionDialog } from "./member-action-dialog";

const description = "이곳은 Muhehe를 찬성하는 곳입니다 이곳은 Muhehe를 찬성하는 곳입니다 이곳은 Muhehe를 찬성하는 곳입니다";

export function AdminReviewScreen() {
  const [tab, setTab] = useState<"communities" | "reports">("communities");
  const [newest, setNewest] = useState(true);
  const [notice, setNotice] = useState("");
  const entries = newest ? [3, 2, 1] : [1, 2, 3];
  return <section className="admin-view scroll-content" aria-label="관리자 화면 미리보기">
    <div className="admin-tabs" aria-label="검토 종류">
      <button aria-pressed={tab === "communities"} onClick={() => { setTab("communities"); setNotice(""); }}>커뮤니티</button>
      <button aria-pressed={tab === "reports"} onClick={() => { setTab("reports"); setNotice(""); }}>신고</button>
    </div>
    <div className="admin-content">
      <div className="filter-chips" aria-label="정렬"><button aria-pressed={newest} onClick={() => setNewest(true)}>최신순</button><button aria-pressed={!newest} onClick={() => setNewest(false)}>과거순</button></div>
      <ul className="review-list">{entries.map(id => tab === "communities" ? <li className="review-community" key={id}>
        <div className="review-heading"><Avatar /><div className="review-name"><strong>Muhehehe</strong></div><div className="review-actions"><button className="primary-action" onClick={() => setNotice("화면 미리보기입니다. 실제 허가는 처리되지 않습니다.")}>허가</button><button onClick={() => setNotice("화면 미리보기입니다. 실제 취소는 처리되지 않습니다.")}>취소</button></div></div>
        <p>{description}</p>
      </li> : <li className="review-report" key={id}>
        <span className="report-thumbnail" /><div className="report-copy"><span>폭력적 또는 혐오스러운 콘텐츠</span><small><Avatar /> min chong</small></div><div className="review-actions"><button className="primary-action" onClick={() => setNotice("화면 미리보기입니다. 실제 삭제는 처리되지 않습니다.")}>삭제</button><button onClick={() => setNotice("화면 미리보기입니다. 실제 취소는 처리되지 않습니다.")}>취소</button></div>
      </li>)}</ul>

      {notice && <p className="preview-notice" role="status">{notice}</p>}
    </div>
  </section>;
}

type CommunityAdminProps = {
  community:Community|null; currentUserId:number|null; members:boolean;
  onMembers:()=>void; onBack:()=>void; onSelect:(community:Community)=>void;
  onComments:(postId:number)=>void; onProfile:(userId:number)=>void;
  onDelete:(community:Community,postId:number)=>Promise<void>;
};
export function CommunityAdminScreen(props:CommunityAdminProps) {
  const galleries=useGalleries(0);
  const available=galleries.status==="ready"?galleries.galleries.filter(gallery=>isCommunityOwner(gallery,props.currentUserId)):[];
  const community=props.community??(available[0]?galleryToCommunity(available[0]):null);
  if(!community) return <section className="community-admin-status scroll-content"><h1>커뮤니티 관리</h1><p role="status">{galleries.status==="loading"?"커뮤니티를 불러오는 중...":galleries.status==="error"?"커뮤니티를 불러오지 못했습니다.":"관리할 수 있는 커뮤니티가 없습니다."}</p>{galleries.status==="error"&&<button className="gray-pill" onClick={galleries.refetch}>다시 시도</button>}</section>;
  if(!isCommunityOwner(community,props.currentUserId)) return <section className="community-admin-status"><h1>커뮤니티 관리</h1><p role="alert">커뮤니티 개설자만 관리할 수 있습니다.</p><button className="gray-pill" onClick={props.onBack}>돌아가기</button></section>;
  if(props.members)return <CommunityMembers key={community.galleryId} community={community} currentUserId={props.currentUserId} onBack={props.onBack} onProfile={props.onProfile}/>;
  return <CommunityDetailScreen community={community} onManage={()=>{props.onSelect(community);props.onMembers();}} onComments={postId=>{props.onSelect(community);props.onComments(postId);}} onProfile={props.onProfile} onModerateDelete={postId=>props.onDelete(community,postId)}/>;
}
function CommunityMembers({community,currentUserId,onBack,onProfile}:{community:Community;currentUserId:number|null;onBack:()=>void;onProfile:(id:number)=>void}) {
  const [query,setQuery]=useState("");
  const input=useRef<HTMLInputElement>(null);
  const [members,setMembers]=useState<PreviewCommunityMember[]>(()=>isPreviewMode()?getPreviewCommunityMembers(community.galleryId,currentUserId):[]);
  const [notice,setNotice]=useState("");
  const [selected,setSelected]=useState<{member:PreviewCommunityMember;action:"suspend"|"expel"}|null>(null);
  const matches=members.filter(member=>member.nickname.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  function confirm(reason:string,days:number) {
    if(!selected||!isPreviewMode())return;
    moderatePreviewCommunityMember(community.galleryId,currentUserId,selected.member.userId,selected.action,reason,days);
    setMembers(getPreviewCommunityMembers(community.galleryId,currentUserId));
    setNotice(`미리보기: ${selected.member.nickname} 님을 ${selected.action==="expel"?"추방했습니다.":`${days}일간 이용정지했습니다.`}`);
    setSelected(null);
  }
  return <section className="community-members-view" aria-label={`${community.name} 멤버 관리`}>
    <div className="search-line"><button onClick={onBack} aria-label="돌아가기"><Asset name="search-back.svg"/></button><label><Asset name="search-input.svg"/><input ref={input} aria-label="커뮤니티 멤버 검색" value={query} onChange={event=>setQuery(event.target.value)} placeholder="검색"/><button aria-label="검색어 지우기" onClick={()=>{setQuery("");input.current?.focus();}}><Asset name="search-close.svg"/></button></label></div>
    <div className="community-members-content scroll-content">
      <ul className="community-member-list">{matches.map(member=><CommunityMemberRow key={member.userId} member={member} isAdmin={isCommunityOwner(community,member.userId)} canManage={canManageCommunityMember(community,currentUserId,member.userId)} onProfile={onProfile} onAction={action=>setSelected({member,action})}/>)}</ul>
      {!isPreviewMode()&&<p className="community-admin-empty" role="status">현재 멤버 목록을 사용할 수 없습니다.</p>}
      {isPreviewMode()&&matches.length===0&&<p className="community-admin-empty" role="status">검색 결과가 없습니다.</p>}
      {notice&&<p className="community-admin-empty" role="status">{notice}</p>}
    </div>
    {selected&&<MemberActionDialog key={`${selected.member.userId}:${selected.action}`} action={selected.action} member={selected.member} onConfirm={confirm} onClose={()=>setSelected(null)}/>}
  </section>;
}
function CommunityMemberRow({member,isAdmin,canManage,onProfile,onAction}:{member:PreviewCommunityMember;isAdmin:boolean;canManage:boolean;onProfile:(id:number)=>void;onAction:(action:"suspend"|"expel")=>void}) {
  const [menu,setMenu]=useState(false);
  const anchor=useRef<HTMLButtonElement>(null);
  return <li className="community-member-row"><button className="community-member-profile" onClick={()=>onProfile(member.userId)}><Avatar src={member.profileImageUrl}/><span><strong>{member.nickname}</strong><small>{isAdmin?"관리자":"멤버"}{member.suspendedUntil?" · 이용정지 중":""}</small></span></button>
    {canManage&&<button className="community-member-option" ref={anchor} aria-label={`${member.nickname} 관리`} aria-expanded={menu} onClick={()=>setMenu(open=>!open)}><Asset name="post-more.svg"/></button>}
    {menu&&<AnchoredActionsMenu anchorRef={anchor} onClose={()=>setMenu(false)} label={`${member.nickname} 관리 메뉴`} height={100}><button role="menuitem" disabled={Boolean(member.suspendedUntil)} onClick={()=>{setMenu(false);onAction("suspend");}}><Asset name="admin-suspend.svg"/>이용정지</button><button role="menuitem" onClick={()=>{setMenu(false);onAction("expel");}}><Asset name="admin-expel.svg"/>추방</button></AnchoredActionsMenu>}
  </li>;
}
