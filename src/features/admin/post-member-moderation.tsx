import {useCurrentUserId} from "@/hooks/use-current-user";
import {canManageCommunityMember} from "./permissions";
import {MemberActionDialog} from "./member-action-dialog";
export type PostModerationCommunity={galleryId:number;ownerId?:number};
export function PostMemberModeration({community,member,action,onClose}:{community:PostModerationCommunity;member:{userId:number;nickname:string};action:"suspend"|"expel";onClose:()=>void;onDone:(message:string)=>void}){
 const userId=useCurrentUserId();
 return <MemberActionDialog member={member} action={action} onClose={onClose} onConfirm={()=>{
  if(!canManageCommunityMember(community,userId,member.userId))throw new Error("커뮤니티 관리자만 멤버를 제재할 수 있습니다.");
  throw new Error("현재 서버에서 멤버 제재를 지원하지 않습니다.");
 }}/>
}
