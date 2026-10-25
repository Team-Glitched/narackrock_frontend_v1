"use client";
import { useEffect,useRef,useState } from "react";
import { Avatar } from "@/components/app/shared";
import { useWorkspace,preserveSubmission } from "@/features/workspace/workspace-store";
import "./notification-badges.css";
import { getContributionInbox,reviewContribution,type ContributionNotificationDto } from "@/lib/api/composition";

const notificationFilters=[
 {id:"all",label:"전체"},
 {id:"request",label:"받은 요청"},
 {id:"pending",label:"보낸 요청"},
 {id:"approved",label:"승인 완료"},
 {id:"rejected",label:"반려·취소"},
 {id:"resource",label:"오픈소스 전환"},
] as const;
type NotificationFilter=typeof notificationFilters[number]["id"];

export function NotificationsScreen({onBack,onOpenProject,onOpenSubmission}:{onBack:()=>void;onOpenProject:(id:number)=>void;onOpenSubmission?:(id:number)=>void;onOpenFriends?:()=>void;onReviewInbox?:()=>void}){
 const [filter,setFilter]=useState<NotificationFilter>("all");
 const panel=useRef<HTMLElement>(null);const {submissions,resources}=useWorkspace();
 const [items,setItems]=useState<ContributionNotificationDto[]>([]),[busy,setBusy]=useState<number|null>(null),[error,setError]=useState<string|null>(null),[notice,setNotice]=useState<string|null>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;panel.current?.focus();return()=>previous?.focus();},[]);
 useEffect(()=>{let active=true;getContributionInbox().then(value=>{if(active)setItems(value);}).catch(()=>{if(active)setError("참여 요청을 불러오지 못했습니다.");}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 async function review(item:ContributionNotificationDto,decision:"APPROVED"|"REJECTED"){if(busy!==null)return;setBusy(item.contributionId);setError(null);try{await reviewContribution(item.projectId,item.contributionId,decision);setItems(old=>old.filter(x=>x.contributionId!==item.contributionId));setNotice(decision==="APPROVED"?"참여 요청을 승인했습니다.":"참여 요청을 취소했습니다.");}catch{setError("요청을 처리하지 못했습니다.");}finally{setBusy(null);}}
 const visibleItems=filter==="all"||filter==="request"?items:[];
 const visibleSubmissions=submissions.filter(item=>filter==="all"||
  filter==="resource"&&item.mine&&item.status==="REJECTED"||
  filter==="approved"&&item.status==="APPROVED"||
  filter==="rejected"&&item.status==="REJECTED"||
  filter==="pending"&&item.mine&&item.status==="PENDING"||
  filter==="request"&&!item.mine&&item.status==="PENDING");
 const resultCount=visibleItems.length+visibleSubmissions.length;
 return <div className="notification-overlay" onKeyDown={e=>{
   if(e.key==="Escape"){e.stopPropagation();onBack();}
   if(e.key!=="Tab"||!panel.current)return;
   const controls=[...panel.current.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled)')];
   const first=controls[0],last=controls[controls.length-1];
   if(e.shiftKey&&(document.activeElement===first||document.activeElement===panel.current)){e.preventDefault();last?.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
 }}><button className="notification-backdrop" aria-label="알림 닫기" onClick={onBack}/><section ref={panel} tabIndex={-1} className="notifications-screen" role="dialog" aria-modal="true" aria-label="알림"><button className="notification-grip" aria-label="알림 닫기" onClick={onBack}/><div className="notification-scroll"><h1 className="notification-title">알림</h1><div className="notification-filter-options" role="group" aria-label="알림 종류">{notificationFilters.map(option=><button key={option.id} type="button" aria-pressed={filter===option.id} onClick={e=>{setFilter(option.id);e.currentTarget.scrollIntoView({block:"nearest",inline:"nearest",behavior:"auto"});}}>{option.label}</button>)}</div><p className="notification-result-count" role="status" aria-live="polite">{loading?"불러오는 중":`${resultCount}개`}</p>{loading&&<p role="status">불러오는 중...</p>}{error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}<ul className="notification-events">
 {visibleItems.map(item=><li key={`server:${item.contributionId}`}><Avatar/><div><span className="notification-kind notification-kind--request">받은 참여 요청</span><button className="notification-event-copy" onClick={()=>onOpenProject(item.projectId)}><strong>{item.nickname}</strong><span>님이 {item.projectTitle}에 참여를 요청했습니다.</span>{item.description&&<small>{item.description}</small>}</button><div className="notification-event-actions"><button disabled={busy!==null} onClick={()=>void review(item,"APPROVED")}>승인</button><button disabled={busy!==null} onClick={()=>void review(item,"REJECTED")}>취소</button></div></div></li>)}
 {visibleSubmissions.map(item=><li key={`local:${item.id}`}><Avatar/><div><div className="notification-kind-row"><span className={`notification-kind notification-kind--${item.status==="APPROVED"?"approved":item.status==="REJECTED"?"rejected":item.mine?"pending":"request"}`}>{item.status==="APPROVED"?"승인 완료":item.status==="REJECTED"?"반려·취소":item.mine?"보낸 참여 요청":"받은 참여 요청"}</span>{item.mine&&item.status==="REJECTED"&&<span className="notification-kind notification-kind--resource">{resources.some(resource=>resource.id===item.id)?"오픈소스 전환됨":"오픈소스 전환 가능"}</span>}</div><button className="notification-event-copy" onClick={()=>onOpenSubmission?.(item.id)}><strong>{item.mine?item.title:item.author}</strong><span>{item.mine?item.status==="PENDING"?"에 보낸 참여 요청이 승인 대기 중입니다.":item.status==="APPROVED"?"에 보낸 참여 요청이 승인되었습니다.":"에 보낸 파트가 취소·반려되었습니다.":item.status==="PENDING"?`님이 ${item.title}에 참여를 요청했습니다.`:`님의 참여 요청을 ${item.status==="APPROVED"?"승인":"취소"}했습니다.`}</span>{item.description&&<small>{item.description}</small>}{item.status==="REJECTED"&&item.reason&&<small>{item.reason}</small>}</button>{item.mine&&item.status==="REJECTED"&&<><p>취소된 파트를 오픈소스로 보관할까요?</p><div className="notification-event-actions"><button disabled={resources.some(r=>r.id===item.id)} onClick={()=>{try{preserveSubmission(item.id);setNotice("오픈소스로 보관했습니다. 설정의 보관함에서 확인할 수 있어요.");}catch{setError("보관하지 못했습니다.");}}}>{resources.some(r=>r.id===item.id)?"전환됨":"오픈소스로 전환"}</button></div></>}</div></li>)}
 </ul>{!loading&&resultCount===0&&<p className="profile-list-empty">{filter==="all"?"새로운 알림이 없습니다.":"선택한 종류의 알림이 없습니다."}</p>}</div></section></div>;
}
