import { sharedStyles } from "@/styles/shared.styles";
import { communityStyles } from "@/styles/community.styles";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/styles/variants";
import type { PostTargetStatus } from "@/features/community/post-target";
import { SourcePianoEditor } from "@/features/composition/source-piano-editor";
import type { MidiNoteDto } from "@/lib/api/composition";
import { CompositionChoiceScreen, CompositionUploadScreen, CompositionRecordScreen } from "./composition-creation-screens";
import { prepareAudioFile, type AudioSelection } from "@/features/composition/prepare-audio-file";
import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentUserId } from "@/lib/api/client";
import { readCreationDraft, restoreCreationDraft, rememberCreationDraft, clearCreationDraft } from "@/features/community/creation-draft";
import { CanvasDialog } from "@/components/app/dialog";
import { createPost } from "@/lib/api/community";
import { uploadMedia } from "@/lib/api/media";
import { validatePostImage } from "@/features/community/post-image";
import { createPreviewCommunity } from "@/features/preview/demo-api";
import { createPreviewSource } from "@/features/preview/source-store";
import { isPreviewMode } from "@/features/preview/preview-mode";
import { useCommunityMembership } from "./community-membership";
import type { GalleryListItem } from "@/lib/api/contracts";
export function SocialCreate({onCancel,postTargetStatus="ready",kind,galleryId,onCreated,audioStage="details",onAudioStage}:{onCancel:()=>void;postTargetStatus?:PostTargetStatus;audioStage?:"details"|"choose"|"upload"|"record"|"note";onAudioStage?:(stage:"details"|"choose"|"upload"|"record"|"note")=>void;kind:"post"|"community"|"source";galleryId:number;onCreated:(gallery?:GalleryListItem)=>void}) {
  const [draftKey]=useState(()=>`${isPreviewMode()?"preview":"live"}:${getCurrentUserId()??"guest"}:${kind}`);
  const initial=readCreationDraft(draftKey);
  const [restoring,setRestoring]=useState(true);
  const [discarding,setDiscarding]=useState(false);
  const [restoreError,setRestoreError]=useState("");

  const [storageError,setStorageError]=useState("");
  const [confirmDiscard,setConfirmDiscard]=useState(false);
  const writes=useRef(0);
  const [pianoNotes,setPianoNotes]=useState<MidiNoteDto[]>(()=>initial?.notes??[]);
  const [pianoBpm,setPianoBpm]=useState(()=>initial?.bpm??120);
  const [title,setTitle]=useState(()=>initial?.title??"");
  const [content,setContent]=useState(()=>initial?.content??"");
  const [image,setImage]=useState<{file:File;url:string}|null>(()=>initial?.image?{file:initial.image,url:URL.createObjectURL(initial.image)}:null);
  const [audio,setAudio]=useState<File|null>(()=>initial?.audio??null);
  const [error,setError]=useState<string|null>(null);const [busy,setBusy]=useState(false);
  const draftValue=useMemo(()=>({title,content,image:image?.file??null,audio,notes:pianoNotes,bpm:pianoBpm}),[title,content,image,audio,pianoNotes,pianoBpm]);
  const [savedDraft,setSavedDraft]=useState<typeof draftValue|null>(null);
  const draftSaving=!restoring&&!discarding&&!storageError&&savedDraft!==draftValue;
  useEffect(()=>{
    let active=true;
    void restoreCreationDraft(draftKey).then(draft=>{
      if(!active||!draft)return;
      if("restorationWarning" in draft&&typeof draft.restorationWarning==="string")setRestoreError(draft.restorationWarning);
      setTitle(draft.title);setContent(draft.content);setAudio(draft.audio);setPianoNotes(draft.notes);setPianoBpm(draft.bpm);
      setImage(draft.image?{file:draft.image,url:URL.createObjectURL(draft.image)}:null);
    }).catch(()=>{if(active)setRestoreError("첨부 파일을 복원하지 못했습니다. 다시 첨부해주세요.");}).finally(()=>{if(active)setRestoring(false);});
    return()=>{active=false;};
  },[draftKey]);
  useEffect(()=>{
    if(restoring||discarding)return;
    const revision=++writes.current;
    void rememberCreationDraft(draftKey,draftValue).then(()=>{if(writes.current===revision){setStorageError("");setSavedDraft(draftValue);}}).catch(cause=>{if(writes.current===revision){setStorageError(cause instanceof Error?cause.message:"초안을 저장하지 못했습니다.");}});
  },[draftKey,draftValue,restoring,discarding]);
  useEffect(()=>{
    if(!draftSaving)return;
    const preventLoss=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",preventLoss);
    return()=>window.removeEventListener("beforeunload",preventLoss);
  },[draftSaving]);
  const setAudioStage=(stage:"details"|"choose"|"upload"|"record"|"note")=>onAudioStage?.(stage);
  async function selectAudio(file:File,selection?:AudioSelection){setRestoreError("");const {wav}=await prepareAudioFile(file,selection);setAudio(new File([wav],"opensource.wav",{type:"audio/wav"}));setAudioStage("details");}
  const membership=useCommunityMembership();
  useEffect(()=>()=>{if(image)URL.revokeObjectURL(image.url);},[image]);
  async function submit(event:React.FormEvent){event.preventDefault();if(busy||!title.trim()||!content.trim()||(kind==="post"&&postTargetStatus!=="ready"))return;setBusy(true);setError(null);try{
    if(kind==="post"){const imageId=image?await uploadMedia(image.file,"IMAGE"):null;await createPost(galleryId,title.trim(),content.trim(),imageId);setDiscarding(true);clearCreationDraft(draftKey);onCreated();}
    else if(!isPreviewMode())throw new Error("생성 화면은 준비되어 있으며, 서버의 생성 API 연결이 필요합니다.");
    else if(kind==="community"){const imageUrl=image?URL.createObjectURL(image.file):null;const gallery=createPreviewCommunity(title,content,imageUrl);await membership.toggle(gallery.galleryId);setDiscarding(true);clearCreationDraft(draftKey);onCreated(gallery);}
    else {if(!audio)throw new Error("오디오 파일을 선택해주세요.");createPreviewSource(title,content,audio,image?URL.createObjectURL(image.file):null);setDiscarding(true);clearCreationDraft(draftKey);onCreated();}
  }catch(cause){setError(cause instanceof Error?cause.message:"생성하지 못했습니다.");}finally{setBusy(false);}}
  if(restoring)return <p className={sharedStyles.creationRestoreStatus} role="status">작성 중인 내용을 불러오는 중...</p>;
  if(kind==="source"&&audioStage!=="details")return <div className={sharedStyles.sourceAudioFlow}>{audioStage==="choose"?<CompositionChoiceScreen busy={false} error={null} onBack={()=>setAudioStage("details")} onChoose={method=>setAudioStage(method)}/>:audioStage==="upload"?<CompositionUploadScreen saveLabel="오디오 선택 완료" onBack={()=>setAudioStage("choose")} onSave={selectAudio}/>:audioStage==="note"?<SourcePianoEditor notes={pianoNotes} setNotes={setPianoNotes} bpm={pianoBpm} onBpm={setPianoBpm} onBack={()=>setAudioStage("choose")} onSave={file=>{setAudio(file);setAudioStage("details");}}/>:<CompositionRecordScreen saveLabel="녹음 선택 완료" onBack={()=>setAudioStage("choose")} onSave={selectAudio}/>}</div>;
  return <form className={cn(communityStyles.socialCreateView, sharedStyles.scrollContent)} onSubmit={submit} aria-label={kind==="post"?"게시글 작성":kind==="community"?"커뮤니티 생성":"오픈소스 생성"}><div className={communityStyles.socialCreateFields}>
    <label>{kind==="post"?"제목":kind==="community"?"커뮤니티 이름":"오픈소스 이름"}<input aria-label={kind==="post"?"게시글 제목":kind==="community"?"커뮤니티 이름":"오픈소스 이름"} disabled={busy} value={title} onChange={event=>setTitle(event.target.value)} maxLength={100} required/></label>
    <label>{kind==="post"?"본문":"설명"}<textarea aria-label={kind==="post"?"게시글 내용":"설명"} disabled={busy} value={content} onChange={event=>setContent(event.target.value)} required rows={1}/></label>
    {kind==="source"&&<label>오디오<button type="button" aria-label="오디오 추가" disabled={busy} className={sharedStyles.sourceAudioSelect} onClick={()=>setAudioStage("choose")}>{audio?"오디오 선택됨 · 다시 선택":"오디오 추가"}</button></label>}
    <label>{kind==="community"?"프로필":kind==="source"?"앨범":"사진"}<span className={sharedStyles.socialImagePicker}>{image?<img src={image.url} alt="첨부 이미지 미리보기" width={350} height={280}/>:<span><strong>{kind==="source"?"앨범 추가":"사진 추가"}</strong><small>JPG, PNG, WEBP 최대 100MB</small></span>}<input aria-label={kind==="source"?"앨범 추가":"사진 추가"} disabled={busy} type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>{const file=event.target.files?.[0];event.target.value="";if(!file)return;try{validatePostImage(file);setRestoreError("");setImage({file,url:URL.createObjectURL(file)});setError(null);}catch(cause){setError(cause instanceof Error?cause.message:"이미지를 추가하지 못했습니다.");}}}/></span>{image&&<button type="button" className={sharedStyles.creationRemoveImage} disabled={busy} onClick={()=>setImage(null)}>{kind==="source"?"앨범 이미지 삭제":kind==="community"?"프로필 이미지 삭제":"첨부 사진 삭제"}</button>}</label>
  </div><p className={sharedStyles.creationSaveStatus} role="status">{draftSaving?"초안을 저장하는 중...":storageError?"초안을 저장하지 못했습니다.":"이 브라우저에 초안이 임시 저장됩니다."}</p>{kind==="post"&&postTargetStatus!=="ready"&&<p className={communityStyles.postTargetNotice} role={postTargetStatus==="loading"?"status":"alert"}>{postTargetStatus==="loading"?"게시할 커뮤니티를 확인하는 중입니다.":postTargetStatus==="error"?"커뮤니티를 불러오지 못했습니다. 상단의 커뮤니티 선택에서 다시 시도해주세요.":"상단에서 게시할 커뮤니티를 선택해주세요."}</p>}{error&&<p role="alert">{error}</p>}{storageError&&<p role="alert">{storageError}</p>}{restoreError&&<p role="alert">{restoreError}</p>}<button className={communityStyles.socialCreateSubmit} type="submit" disabled={busy||(kind==="post"&&postTargetStatus!=="ready")||!title.trim()||!content.trim()||(kind==="source"&&!audio)}>{busy?"저장 중...":"입력 완료"}</button><button type="button" className={sharedStyles.creationDiscard} disabled={busy} onClick={()=>setConfirmDiscard(true)}>작성 취소</button>{confirmDiscard&&<CanvasDialog className={sharedStyles.creationDiscardDialog} titleId="creation-discard-title" onClose={()=>setConfirmDiscard(false)}><h2 id="creation-discard-title">작성 중인 내용을 삭제할까요?</h2><p>제목, 본문 및 첨부 파일이 삭제됩니다.</p><div><button type="button" className={buttonVariants({
  tone: "secondary"
})} onClick={()=>setConfirmDiscard(false)}>계속 작성</button><button type="button" className={buttonVariants({
  tone: "primary"
})} onClick={()=>{setDiscarding(true);clearCreationDraft(draftKey);onCancel();}}>삭제하고 나가기</button></div></CanvasDialog>}</form>;
}
