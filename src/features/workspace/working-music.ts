import type {Work} from "./workspace-store.ts";
/** Only unfinished music that this viewer can actually continue editing. */
export function workingMusic(works:readonly Work[]):Work[]{
 return works.filter(work=>{
  const {viewerPermission:viewer,project,tracks}=work.composition;
  return viewer.canEdit&&project.status==="DRAFT" || viewer.canContribute&&tracks.some(track=>track.ownerId===viewer.userId&&track.clips.some(clip=>clip.approvalStatus==="DRAFT"));
 }).sort((a,b)=>Date.parse(b.updatedAt)-Date.parse(a.updatedAt));
}
