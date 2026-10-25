"use client";
import {useCurrentUserId} from "@/hooks/use-current-user";
import {isPreviewMode} from "@/features/preview/preview-mode";
import {moderatePreviewCommunityMember} from "@/features/preview/demo-api";
import {canManageCommunityMember} from "./permissions";
import {MemberActionDialog} from "./member-action-dialog";
export type PostModerationCommunity={galleryId:number;ownerId?:number};
export function PostMemberModeration({community,member,action,onClose,onDone}:{community:PostModerationCommunity;member:{userId:number;nickname:string};action:"suspend"|"expel";onClose:()=>void;onDone:(message:string)=>void}){
 const userId=useCurrentUserId();
 return <MemberActionDialog member={member} action={action} onClose={onClose} onConfirm={(reason,days)=>{
  if(!canManageCommunityMember(community,userId,member.userId))throw new Error("커뮤니티 관리자만 멤버를 제재할 수 있습니다.");
  if(!isPreviewMode())throw new Error("현재 서버에서 멤버 제재를 지원하지 않습니다.");
  moderatePreviewCommunityMember(community.galleryId,userId,member.userId,action,reason,days);
  onDone(`${member.nickname} 님을 ${action==="expel"?"커뮤니티에서 추방했습니다.":`${days}일간 이용정지했습니다.`}`);
 }}/>
}
