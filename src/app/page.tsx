"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { WorkspaceScreen, SubmissionsScreen, SubmissionDetailScreen, ReviewInboxScreen, SourceLibraryScreen } from "@/features/workspace/workspace-screens";
import { rememberWork, type Resource, type Work } from "@/features/workspace/workspace-store";
import { DesignViewport } from "@/components/app/design-viewport";
import { Footer, Header } from "@/components/app/shared";
import type { View } from "@/features/navigation/types";
import { AuthScreen, type PendingProfileSetup } from "@/features/screens/auth-screens";
import { JoinedCommunitiesScreen } from "@/features/screens/community-directory";
import { CommunityMembershipProvider, createServerMembershipApi } from "@/features/screens/community-membership";
import type { CommunityTab } from "@/features/screens/mobile-screens";
import { ChartsScreen, CommunityScreen, FriendsScreen, HomeScreen, PostsScreen, type SongChartKind } from "@/features/screens/mobile-screens";
import { EditProfileScreen, InitialProfileSetupScreen, ProfileScreen } from "@/features/profile/profile-screens";
import { AbyssScreen } from "@/features/screens/abyss-screen";
import { ChatScreen } from "@/features/screens/chat-screen";
import { NotificationsScreen } from "@/features/screens/notifications-screen";
import { OpensourceScreen, OpensourceDetailScreen } from "@/features/screens/opensource-screens";
import { NoteEditorScreen, StudioScreen } from "@/features/screens/studio-screens";
import { CompositionChoiceScreen, CompositionRecordScreen, CompositionUploadScreen, type CreationMethod } from "@/features/screens/composition-creation-screens";
import { readSavedSourceAudio, type SavedSource } from "@/features/community/saved-sources";
import { prepareAudioFile, type AudioSelection } from "@/features/composition/prepare-audio-file";
import { createHtiMidiLayerPlan } from "@/features/composition/hti-midi-flow";
import { createAudioClip, createMidiClip, saveMidiClip, createTrack, getComposition, transformRecordingToMidi, uploadMedia } from "@/lib/api/composition";
import { isPreviewMode } from "@/features/preview/preview-mode";
import { views } from "@/features/navigation/types";
import { useWebMcpNavigation } from "@/hooks/use-webmcp-navigation";
import { PostCommentsScreen } from "@/features/screens/post-comments";
import { resolvePostTarget } from "@/features/community/post-target";
import { PostCommunityPicker } from "@/features/community/post-community-picker";
import { CommunityDetailScreen } from "@/features/screens/community-detail";
import type { Community } from "@/features/screens/community-card";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { getProfile } from "@/lib/api/profile";

import { ScopedSearch } from "@/features/screens/scoped-search";
import { SocialCreate } from "@/features/screens/social-create";
import { screenScope, creationForView, creationLabels, type SearchScope } from "@/features/navigation/context-actions";
import { useNavigationHistory } from "@/hooks/use-navigation-history";
import { useGalleries } from "@/hooks/use-galleries";
import { DEFAULT_GALLERY_ID } from "@/lib/api/community";
import { galleryToCommunity } from "@/features/screens/community-card";
import { SettingsScreen } from "@/features/settings/settings-screen";
import { SavedScreen } from "@/features/saved/saved-screen";
import { isCommunityOwner } from "@/features/admin/permissions";
import { AdminReviewScreen, CommunityAdminScreen } from "@/features/admin/admin-screens";

// Provider가 api를 의존성으로 보므로 렌더마다 새로 만들지 않는다.
const membershipApi = createServerMembershipApi();

function subscribeLocation(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}
function sharedShortSnapshot() {
  const id = Number(new URLSearchParams(window.location.search).get("short"));
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export default function Page() {
  const sharedShortId = useSyncExternalStore(subscribeLocation, sharedShortSnapshot, () => null);
  const [selectedView, setView] = useState<View | null>(null);
  const view: View = selectedView ?? (sharedShortId ? "abyss" : "home");
  const currentUserId = useCurrentUserId();
  const isAuthenticated = currentUserId !== null;
  const [headerProfile, setHeaderProfile] = useState<{ userId: number; imageUrl: string | null } | null>(null);
  const [profileRevision, setProfileRevision] = useState(0);
  const [editOrigin, setEditOrigin] = useState<"settings" | "profile">("profile");
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const headerProfileImageUrl = currentUserId !== null && headerProfile?.userId === currentUserId
    ? headerProfile.imageUrl
    : null;
  const [pendingProfileSetup, setPendingProfileSetup] = useState<PendingProfileSetup | null>(null);
  const activeView: View = currentUserId === null
    && pendingProfileSetup === null
    && (view === "profile" || view === "edit")
    && (view !== "profile" || profileUserId === null)
    ? "login"
    : view;
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [abyssMuted, setAbyssMuted] = useState(false);
  const [communityTab, setCommunityTab] = useState<CommunityTab>("posts");
  const [commentPostId, setCommentPostId] = useState<number | null>(null);
  const [sourceTargetId,setSourceTargetId]=useState(1);
  const [songChartKind, setSongChartKind] = useState<SongChartKind>("popular");
  const [adminCommunity,setAdminCommunity]=useState<Community|null>(null);
  const [adminMembers,setAdminMembers]=useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [compositionTarget, setCompositionTarget] = useState<{ shortId: number | null; projectId: number | null }>({ shortId: null, projectId: null });
  const [abyssTargetShortId, setAbyssTargetShortId] = useState<number | null>(null);
  const [editorTarget, setEditorTarget] = useState<{ trackId: number; clipId: number | null } | null>(null);
  const [reviewOrigin, setReviewOrigin] = useState(false);
  const [searchCommunity,setSearchCommunity]=useState<Pick<Community,"galleryId"|"name">|null>(null);
  const [searchScope,setSearchScope] = useState<SearchScope>("songs");
  const [searchQuery,setSearchQuery] = useState("");
  const [profileOrigin,setProfileOrigin]=useState<{view:View;tab:CommunityTab;community:Community|null;postId:number|null}>({view:"home",tab:"posts",community:null,postId:null});
  const [searchOrigin,setSearchOrigin] = useState<{view:View;tab:CommunityTab;community:Community|null;postId:number|null}>({view:"home",tab:"posts",community:null,postId:null});
  const [createOrigin,setCreateOrigin] = useState<{view:View;tab:CommunityTab;community:Community|null}>({view:"social",tab:"posts",community:null});
  const creationGalleries = useGalleries(selectedView === "createPost" ? 1 : 0);
  const [sourceAudioStage,setSourceAudioStage]=useState<"details"|"choose"|"upload"|"record"|"note">("details");
  const [creationGalleryId,setCreationGalleryId] = useState(DEFAULT_GALLERY_ID);
  const [studioOrigin,setStudioOrigin]=useState<{view:View;item:number;notifications:boolean}>({view:"home",item:101,notifications:false});
  const [songOrigin,setSongOrigin]=useState<View>("home");
  const [submissionOrigin,setSubmissionOrigin]=useState<View>("submissions");
  const [workspaceItem,setWorkspaceItem]=useState(101);
  const [importBusy,setImportBusy]=useState(false);
  const [choiceBusy, setChoiceBusy] = useState(false);
  const [choiceError, setChoiceError] = useState<string | null>(null);

  const navigationSnapshot={studioOrigin,songOrigin,view,profileUserId,communityTab,commentPostId,sourceTargetId,songChartKind,adminCommunity,adminMembers,selectedCommunity,compositionTarget,abyssTargetShortId,editorTarget,reviewOrigin,searchCommunity,searchScope,searchQuery,searchOrigin,createOrigin,sourceAudioStage,creationGalleryId,submissionOrigin,workspaceItem,editOrigin,profileOrigin,notificationsOpen};
  const navigationKey=JSON.stringify([view,profileUserId,communityTab,commentPostId,sourceTargetId,songChartKind,adminCommunity?.galleryId,adminMembers,selectedCommunity?.galleryId,compositionTarget.projectId,compositionTarget.shortId,editorTarget?.trackId,editorTarget?.clipId,sourceAudioStage,workspaceItem,notificationsOpen,submissionOrigin]);
  const navigateBack=useNavigationHistory(navigationSnapshot,navigationKey,state=>{
    if(state.view!=="edit")setPendingProfileSetup(null);
    setStudioOrigin(state.studioOrigin??{view:"home",item:101,notifications:false});setSongOrigin(state.songOrigin??"home");
    setView(state.view);setProfileUserId(state.profileUserId);setCommunityTab(state.communityTab);setCommentPostId(state.commentPostId);setSourceTargetId(state.sourceTargetId);setSongChartKind(state.songChartKind);setAdminCommunity(state.adminCommunity);setAdminMembers(state.adminMembers);setSelectedCommunity(state.selectedCommunity);setCompositionTarget(state.compositionTarget);setAbyssTargetShortId(state.abyssTargetShortId);setEditorTarget(state.editorTarget);setReviewOrigin(state.reviewOrigin);setSearchCommunity(state.searchCommunity);setSearchScope(state.searchScope);setSearchQuery(state.searchQuery);setSearchOrigin(state.searchOrigin);setCreateOrigin(state.createOrigin);setSourceAudioStage(state.sourceAudioStage);setCreationGalleryId(state.creationGalleryId);setSubmissionOrigin(state.submissionOrigin==="submissionDetail"?"submissions":state.submissionOrigin);setWorkspaceItem(state.workspaceItem);setEditOrigin(state.editOrigin);setProfileOrigin(state.profileOrigin);setNotificationsOpen(state.notificationsOpen);
  },(value):value is typeof navigationSnapshot=>{
    if(!value||typeof value!=="object")return false;
    const candidate=value as Record<string,unknown>;
    return Object.keys(navigationSnapshot).filter(key=>!["studioOrigin","songOrigin"].includes(key)).every(key=>key in candidate)&&views.includes(candidate.view as View)&&["posts","community","friends"].includes(candidate.communityTab as string)&&["details","choose","upload","record","note"].includes(candidate.sourceAudioStage as string)&&Boolean(candidate.compositionTarget&&candidate.searchOrigin&&candidate.createOrigin&&candidate.profileOrigin);
  });

  const ownedSearchGallery=creationGalleries.status==="ready"?creationGalleries.galleries.find(gallery=>isCommunityOwner(gallery,currentUserId)):null;

  const go = useCallback((next: View, targetUserId?: number) => {
    if(next==="communityAdmin"){setAdminCommunity(selectedCommunity);setAdminMembers(false);}
    if (next === "edit" && activeView !== "edit") setEditOrigin(activeView === "settings" ? "settings" : "profile");
    if (next === "createSource" && activeView !== "createSource") setSourceAudioStage("details");
    if(next==="submissionDetail")setSubmissionOrigin(notificationsOpen&&activeView!=="submissionDetail"?activeView:activeView==="reviewInbox"?"reviewInbox":activeView==="submissionDetail"?(submissionOrigin==="submissionDetail"?"submissions":submissionOrigin):"submissions");
    if (next === "submissionDetail" && targetUserId !== undefined) setWorkspaceItem(targetUserId);
    if (next === "profile") {
      if(!["profile","settings","edit"].includes(activeView))setProfileOrigin({view:activeView,tab:communityTab,community:selectedCommunity,postId:commentPostId});
      setProfileUserId(targetUserId ?? null);
    }
    if (next === "search") {
      if(activeView==="search"){setCommentPostId(null);return;}
      const community=selectedCommunity??(activeView==="communityAdmin"?(adminCommunity??ownedSearchGallery):null);
      setSearchCommunity(community?{galleryId:community.galleryId,name:community.name}:null);
      setSearchScope(screenScope(activeView,communityTab,Boolean(selectedCommunity)||commentPostId!==null));setSearchQuery("");setSearchOrigin({view:activeView,tab:communityTab,community:selectedCommunity,postId:commentPostId});setSelectedCommunity(null);setCommentPostId(null);setView("search");return;
    }
    if (next === "notifications") { setNotificationsOpen(true); return; }
    setNotificationsOpen(false);
    setCommentPostId(null);
    setSelectedCommunity(null);
    if (next === "studio") {setSongOrigin(activeView);setStudioOrigin({view:activeView,item:workspaceItem,notifications:false});setCompositionTarget({ shortId: null, projectId: null });}
    if (next === "abyss") {setSongOrigin("home");setAbyssTargetShortId(null);}
    if (next === "friends") setCommunityTab("friends");
    if (next === "community") setCommunityTab("community");
    setView(next === "friends" || next === "community" ? "social" : next);
  }, [activeView,communityTab,selectedCommunity,commentPostId,adminCommunity,ownedSearchGallery,workspaceItem,notificationsOpen,submissionOrigin]);

  const authenticate = useCallback(() => {
    setPendingProfileSetup(null);
    setProfileRevision(current => current + 1);
    setView("home");
  }, []);

  const profileUpdated = useCallback(() => {
    setProfileRevision(current => current + 1);
    go(editOrigin);
  }, [go, editOrigin]);

  const startProfileSetup = useCallback((pending: PendingProfileSetup) => {
    setPendingProfileSetup(pending);
    setView("edit");
  }, []);

  const joinShort = useCallback((shortId: number) => {
    setStudioOrigin({view:"abyss",item:workspaceItem,notifications:false});
    setReviewOrigin(false);
    setCompositionTarget({ shortId, projectId: null });
    setView("studio");
  }, [workspaceItem]);

  const selectProject = useCallback((projectId: number) => setCompositionTarget((current) => ({ ...current, projectId })), []);

  const returnToJoinedShort = useCallback((shortId: number) => {
    setAbyssTargetShortId(shortId);
    setView("abyss");
  }, []);

  const openHomeShort = useCallback((shortId: number) => {
    setSongOrigin(activeView);
    setAbyssTargetShortId(shortId);
    setView("abyss");
  }, [activeView]);

  const openSongChart = useCallback((kind: SongChartKind) => {
    setSongChartKind(kind);
    setView("charts");
  }, []);

  const startDraft = useCallback((projectId: number) => {
    setReviewOrigin(false);
    setCompositionTarget({ shortId: null, projectId });
    setChoiceError(null);
    setView("choose");
  }, []);

  const chooseLayer = useCallback(async (method: CreationMethod) => {
    const projectId = compositionTarget.projectId;
    if (projectId == null || choiceBusy) return;
    if (method !== "note") { setView(method); return; }
    setChoiceBusy(true); setChoiceError(null);
    try {
      const composition = await getComposition(projectId);
      const { trackId } = await createTrack(projectId, `피아노롤 ${composition.tracks.length + 1}`, "piano", composition.tracks.length);
      setEditorTarget({ trackId, clipId: null });
      setView("note");
    } catch (cause) {
      setChoiceError(cause instanceof Error ? cause.message : "레이어를 만들지 못했습니다.");
    } finally { setChoiceBusy(false); }
  }, [compositionTarget.projectId, choiceBusy]);

  const saveAudio = useCallback(async (file: File, selection?: AudioSelection) => {
    const projectId = compositionTarget.projectId;
    if (projectId == null) throw new Error("곡을 먼저 선택해 주세요.");
    const { wav, durationMs } = await prepareAudioFile(file, selection);
    const composition = await getComposition(projectId);
    if (durationMs > composition.project.maxDurationMs) throw new Error("오디오는 1분 이하여야 합니다.");
    const mediaFileId = await uploadMedia(wav, "AUDIO");
    const { trackId } = await createTrack(projectId, `오디오 ${composition.tracks.length + 1}`, null, composition.tracks.length);
    const { bpm, ppq, maxTick } = composition.project;
    const durationTick = Math.max(1, Math.min(maxTick, Math.ceil(durationMs * bpm * ppq / 60_000)));
    await createAudioClip(projectId, trackId, mediaFileId, durationTick);
    setView("studio");
  }, [compositionTarget.projectId]);

  const transformRecording = useCallback(async (file: File) => {
    const projectId = compositionTarget.projectId;
    if (projectId == null) throw new Error("곡을 먼저 선택해 주세요.");
    const [{ wav, durationMs }, composition] = await Promise.all([
      prepareAudioFile(file),
      getComposition(projectId),
    ]);
    if (durationMs > composition.project.maxDurationMs) throw new Error("녹음은 1분 이하여야 합니다.");
    const result = await transformRecordingToMidi(projectId, wav);
    const plan = createHtiMidiLayerPlan(result, composition.tracks.length, composition.project.maxTick);
    const { trackId } = await createTrack(projectId, plan.name, plan.instrument, plan.sortOrder);
    const { clipId } = await createMidiClip(projectId, trackId, 0, plan.durationTick, plan.midiNotes);
    setEditorTarget({ trackId, clipId });
    setView("note");
  }, [compositionTarget.projectId]);

  const editTrack = useCallback((trackId: number, clipId: number | null) => {
    setEditorTarget({ trackId, clipId });
    setView("note");
  }, []);

  const backToStudio = useCallback(() => navigateBack(()=>setView("studio"),{logical:true}), [navigateBack]);
  const returnFromStudio=useCallback(()=>navigateBack(()=>{setView(studioOrigin.view);setWorkspaceItem(studioOrigin.item);setNotificationsOpen(studioOrigin.notifications);},{logical:true}),[navigateBack,studioOrigin]);

  const openReviewProject = useCallback((projectId: number) => {
    setStudioOrigin({view:activeView,item:workspaceItem,notifications:true});
    setNotificationsOpen(false);
    setReviewOrigin(true);
    setCompositionTarget({ shortId: null, projectId });
    setView("studio");
  }, [activeView,workspaceItem]);

  useEffect(() => {
    if (currentUserId === null) return;
    let cancelled = false;
    getProfile(currentUserId).then(profile => {
      if (!cancelled) setHeaderProfile({ userId: currentUserId, imageUrl: profile.profileImageUrl });
    }).catch(() => {
      if (!cancelled) setHeaderProfile({ userId: currentUserId, imageUrl: null });
    });
    return () => { cancelled = true; };
  }, [currentUserId, profileRevision]);

  useWebMcpNavigation(go);
  useEffect(() => {
    if (!isPreviewMode()) return;
    const navigate = (event: Event) => {
      const next = (event as CustomEvent<View>).detail;
      if (views.includes(next)) go(next);
    };
    window.addEventListener("narackrock-preview-navigate", navigate);
    return () => window.removeEventListener("narackrock-preview-navigate", navigate);
  }, [go]);

  const openSource = useCallback((id:number,comments=false)=>{setSourceTargetId(id);go(comments?"opensourceComments":"opensourceDetail");},[go]);
  const openCreate = () => {
    setSourceAudioStage("details");
    const scope=activeView==="search"?searchScope:screenScope(activeView,communityTab,Boolean(selectedCommunity));
    const kind=creationForView(activeView,scope);
    if(kind==="song"){go("studio");return;}
    if(kind==="friend"){go("search");setSearchScope("people");return;}
    setCreateOrigin({view:activeView,tab:communityTab,community:selectedCommunity});setCreationGalleryId(selectedCommunity?.galleryId??(activeView==="search"?searchCommunity?.galleryId:undefined)??(activeView==="communityAdmin"?adminCommunity?.galleryId:undefined)??DEFAULT_GALLERY_ID);setSelectedCommunity(null);setView(kind==="post"?"createPost":kind==="community"?"createCommunity":"createSource");
  };
  const returnFromCreate = useCallback(() => {setView(createOrigin.view);setCommunityTab(createOrigin.tab);setSelectedCommunity(createOrigin.community);},[createOrigin]);
  const returnFromProfile=()=>{setView(profileOrigin.view);setCommunityTab(profileOrigin.tab);setSelectedCommunity(profileOrigin.community);setCommentPostId(profileOrigin.postId);};
  const returnFromSearch = useCallback(() => navigateBack(()=>{setView(searchOrigin.view);setCommunityTab(searchOrigin.tab);setSelectedCommunity(searchOrigin.community);setCommentPostId(searchOrigin.postId);},{logical:true}),[navigateBack,searchOrigin]);

  const resumeWork = useCallback((projectId:number,shortId:number|null)=>{setSongOrigin(activeView);setStudioOrigin({view:activeView,item:workspaceItem,notifications:false});setCompositionTarget({projectId,shortId});setReviewOrigin(false);setView("studio");},[activeView,workspaceItem]);
  const importResource = useCallback(async(resource:Resource,work?:Work)=>{
    if(importBusy)throw new Error("다른 레이어를 추가하는 중입니다.");
    const target=work?{projectId:work.id,shortId:work.shortId}:compositionTarget;
    if(target.projectId===null)throw new Error("곡을 먼저 선택해주세요.");
    setImportBusy(true);
    try {
      const projectId=target.projectId;
      const composition=await getComposition(projectId);
      if(!composition.viewerPermission.canContribute&&!(target.shortId===null&&composition.viewerPermission.canEdit))throw new Error("이 곡에는 레이어를 추가할 수 없습니다.");

      const source=resource.composition.tracks[0];
      if(!source?.clips.length)throw new Error("가져올 클립이 없습니다.");
      if(source.clips.some(c=>c.clipType!=="MIDI"||!c.midiNotes.length))throw new Error("현재 보관함에서는 MIDI 레이어만 가져올 수 있습니다.");
      const ratio=composition.project.ppq/resource.composition.project.ppq;
      if(source.clips.some(c=>(c.startTick+c.durationTick)*ratio>composition.project.maxTick))throw new Error("선택한 레이어가 곡의 최대 길이를 초과합니다.");
      if(activeView==="importSource"||activeView==="note"){
        const current=composition.tracks.find(t=>t.trackId===editorTarget?.trackId);
        if(!current||current.ownerId!==composition.viewerPermission.userId)throw new Error("내 MIDI 레이어에서만 가져올 수 있습니다.");
        const clip=current.clips.find(c=>c.clipId===editorTarget?.clipId&&c.clipType==="MIDI")??current.clips.find(c=>c.clipType==="MIDI");
        const existing=clip?.midiNotes??[];
        const offset=Math.max(0,...existing.map(note=>note.startTick+note.durationTick));
        const notes=[...existing,...source.clips.flatMap(sourceClip=>sourceClip.midiNotes.map(note=>({...note,startTick:offset+Math.round((sourceClip.startTick+note.startTick)*ratio),durationTick:Math.max(1,Math.round(note.durationTick*ratio))})))];
        const duration=Math.max(1,...notes.map(note=>note.startTick+note.durationTick));
        if(duration+(clip?.startTick??0)>composition.project.maxTick)throw new Error("가져온 노트가 곡의 최대 길이를 초과합니다.");
        let clipId=clip?.clipId;
        if(clip)await saveMidiClip(clip.clipId,clip.startTick,duration,notes);
        else clipId=(await createMidiClip(projectId,current.trackId,0,duration,notes)).clipId;
        setEditorTarget({trackId:current.trackId,clipId:clipId??null});
        setView("note");return;
      }
      if(target.shortId!==null&&composition.tracks.some(t=>t.ownerId===composition.viewerPermission.userId))throw new Error("이미 참여한 레이어가 있습니다. 내 MIDI에서 가져오기를 이용해주세요.");
      const {trackId}=await createTrack(projectId,resource.title,source.instrument,composition.tracks.length);
      for(const clip of source.clips) await createMidiClip(projectId,trackId,Math.round(clip.startTick*ratio),Math.max(1,Math.round(clip.durationTick*ratio)),clip.midiNotes.map(note=>({...note,startTick:Math.round(note.startTick*ratio),durationTick:Math.max(1,Math.round(note.durationTick*ratio))})));
      rememberWork(await getComposition(projectId),target.shortId);
      setCompositionTarget(target);
      setView("studio");
    } finally {setImportBusy(false);}
  },[compositionTarget,importBusy,activeView,editorTarget]);

  const importSavedAudio=useCallback(async(source:SavedSource)=>{
    if(importBusy)throw new Error("다른 레이어를 추가하는 중입니다.");
    const projectId=compositionTarget.projectId;if(projectId===null)throw new Error("곡을 먼저 선택해주세요.");
    setImportBusy(true);
    try{
      const current=await getComposition(projectId);
      if(!current.viewerPermission.canContribute&&!(compositionTarget.shortId===null&&current.viewerPermission.canEdit))throw new Error("레이어를 추가할 권한이 없습니다.");
      if(compositionTarget.shortId!==null&&current.tracks.some(track=>track.ownerId===current.viewerPermission.userId))throw new Error("이미 참여한 레이어가 있습니다.");
      const file=await readSavedSourceAudio(source);if(!file)throw new Error("저장된 오디오를 찾을 수 없습니다.");
      const {wav,durationMs}=await prepareAudioFile(file);
      const durationTick=Math.max(1,Math.ceil(durationMs*current.project.bpm*current.project.ppq/60000));
      if(durationMs>current.project.maxDurationMs||durationTick>current.project.maxTick)throw new Error("이 곡의 최대 길이를 초과하는 오디오입니다.");
      const mediaFileId=await uploadMedia(wav,"AUDIO");
      const {trackId}=await createTrack(projectId,source.title,null,current.tracks.length);
      await createAudioClip(projectId,trackId,mediaFileId,durationTick);
      rememberWork(await getComposition(projectId),compositionTarget.shortId);
    }finally{setImportBusy(false);}
  },[compositionTarget,importBusy]);

  const deleteCommunityPost=useCallback(async(community:Community,postId:number)=>{
    if(!isCommunityOwner(community,currentUserId))throw new Error("커뮤니티 개설자만 삭제할 수 있습니다.");
    if(!isPreviewMode())throw new Error("현재 관리자 게시글 삭제를 사용할 수 없습니다.");
    const {moderatePreviewCommunityPost}=await import("@/features/preview/demo-api");
    moderatePreviewCommunityPost(community.galleryId,currentUserId,postId);
  },[currentUserId]);
  const openCommunityManagement=useCallback((community:Community)=>{
    setAdminCommunity(community);setAdminMembers(true);setSelectedCommunity(null);setCommentPostId(null);setView("communityAdmin");
  },[]);
  const backFromCommunityAdmin=()=>{
    if(adminMembers){setAdminMembers(false);return;}
    setView("social");setCommunityTab("community");setSelectedCommunity(adminCommunity);
  };

  const postTargetStatus=resolvePostTarget(creationGalleries,creationGalleryId);

  const content = useMemo(() => {
    if(activeView==="workspace")return <WorkspaceScreen go={go} onResume={resumeWork}/>;
    if(activeView==="submissions")return <SubmissionsScreen onSelect={id=>go("submissionDetail",id)}/>;
    if(activeView==="reviewInbox")return <ReviewInboxScreen onSelect={id=>go("submissionDetail",id)}/>;
    if(activeView==="submissionDetail")return <SubmissionDetailScreen key={workspaceItem} id={workspaceItem} onResume={resumeWork} onOpenSong={openHomeShort}/>;
    if(activeView==="sourceLibrary"||activeView==="importSource")return <SourceLibraryScreen key={activeView} go={go} importing={activeView==="importSource"} onUse={importResource}/>;
    if (commentPostId !== null) return <PostCommentsScreen key={commentPostId} postId={commentPostId} moderation={activeView==="communityAdmin"&&adminCommunity&&isCommunityOwner(adminCommunity,currentUserId)?{galleryId:adminCommunity.galleryId,remove:postId=>deleteCommunityPost(adminCommunity,postId)}:selectedCommunity&&isCommunityOwner(selectedCommunity,currentUserId)?{galleryId:selectedCommunity.galleryId,remove:postId=>deleteCommunityPost(selectedCommunity,postId)}:undefined} onHidden={() => setCommentPostId(null)} onProfile={id => go("profile", id)} />;
    if (selectedCommunity) return <CommunityDetailScreen key={selectedCommunity.id} community={selectedCommunity} onManage={()=>openCommunityManagement(selectedCommunity)} onModerateDelete={isCommunityOwner(selectedCommunity,currentUserId)?postId=>deleteCommunityPost(selectedCommunity,postId):undefined} onProfile={id => go("profile", id)} onComments={setCommentPostId} />;
    if (["createPost","createCommunity","createSource"].includes(activeView)) return <SocialCreate onCancel={returnFromCreate} postTargetStatus={postTargetStatus} key={activeView} audioStage={sourceAudioStage} onAudioStage={setSourceAudioStage} kind={activeView==="createPost"?"post":activeView==="createCommunity"?"community":"source"} galleryId={creationGalleryId} onCreated={gallery=>{if(gallery){setView("social");setCommunityTab("community");setSelectedCommunity(galleryToCommunity(gallery));}else returnFromCreate();}} />;
    if (activeView === "chat") return <ChatScreen go={go} />;
    if (activeView === "settings") return <SettingsScreen go={go} />;
    if (activeView === "saved") return <SavedScreen onOpenPost={setCommentPostId} onOpenSong={openHomeShort} />;
    if (activeView === "admin") return <AdminReviewScreen />;
    if (activeView === "communityAdmin") return <CommunityAdminScreen community={adminCommunity} currentUserId={currentUserId} members={adminMembers} onMembers={()=>setAdminMembers(true)} onBack={()=>{if(adminMembers)setAdminMembers(false);else{setView("social");setCommunityTab("community");setSelectedCommunity(adminCommunity);}}} onSelect={setAdminCommunity} onComments={setCommentPostId} onProfile={id=>go("profile",id)} onDelete={deleteCommunityPost} />;
    if (activeView === "home") return <HomeScreen onResume={resumeWork} go={go} onOpenPost={setCommentPostId} onOpenShort={openHomeShort} onShowSongs={openSongChart} />;
    if (activeView === "abyss") return <AbyssScreen onRememberShort={setAbyssTargetShortId} go={go} onJoin={joinShort} initialShortId={abyssTargetShortId ?? (selectedView === null ? sharedShortId : null)} muted={abyssMuted} />;
    if (activeView === "charts") return <ChartsScreen go={go} kind={songChartKind} onOpenShort={openHomeShort} />;
    if (activeView === "posts") return <PostsScreen go={go} onOpenPost={setCommentPostId} />;
    if (activeView === "friends") return <FriendsScreen go={go} />;
    if (activeView === "search") return <ScopedSearch community={searchCommunity} scope={searchScope} onScope={setSearchScope} query={searchQuery} onQuery={setSearchQuery} onBack={returnFromSearch} onPost={setCommentPostId} onCommunity={community=>{setView("social");setCommunityTab("community");setSelectedCommunity(community);}} onSong={openHomeShort} onProfile={id=>go("profile",id)} onSource={openSource} />;
    if (activeView === "social" || activeView === "community") return <CommunityScreen go={go} tab={communityTab} onTabChange={setCommunityTab} onComments={setCommentPostId} onOpenCommunity={setSelectedCommunity} />;
    if (activeView === "opensource") return <OpensourceScreen go={go} onOpen={openSource} />;
    if (activeView === "opensourceDetail") return <OpensourceDetailScreen key={sourceTargetId} sourceId={sourceTargetId} onProfile={id=>go("profile",id)} />;
    if (activeView === "opensourceComments") return <OpensourceDetailScreen key={sourceTargetId} sourceId={sourceTargetId} focusComments onProfile={id=>go("profile",id)} />;
    if (activeView === "joined") return <JoinedCommunitiesScreen onOpen={setSelectedCommunity} />;
    if (activeView === "profile") return <ProfileScreen key={profileUserId ?? "me"} userId={profileUserId ?? undefined} go={go} onOpenShort={openHomeShort} onOpenPost={setCommentPostId} />;
    if (activeView === "login") return <AuthScreen onAuthenticated={authenticate} onFirstLogin={startProfileSetup} />;
    if (activeView === "edit" && pendingProfileSetup) return <InitialProfileSetupScreen {...pendingProfileSetup} onSaved={authenticate} />;
    if (activeView === "edit") return <EditProfileScreen onSaved={profileUpdated} />;
    if (activeView === "choose") return <CompositionChoiceScreen onChoose={(method) => { void chooseLayer(method); }}
      onBack={() => setView("studio")} busy={choiceBusy} error={choiceError} />;
    if (activeView === "upload") return <CompositionUploadScreen onSave={saveAudio} onBack={() => setView("choose")} />;
    if (activeView === "record") return <CompositionRecordScreen onSave={saveAudio} onTransform={transformRecording} onBack={() => setView("choose")} />;
    if (activeView === "note") return <NoteEditorScreen key={`${compositionTarget.projectId}:${editorTarget?.trackId}:${editorTarget?.clipId}`}
      projectId={compositionTarget.projectId}
      trackId={editorTarget?.trackId ?? null}
      clipId={editorTarget?.clipId ?? null}
      onBack={backToStudio}
      onAddLayer={() => { setChoiceError(null); setView("choose"); }}
      onImportResource={importResource}
    />;
    return <StudioScreen
      go={go}
      onExit={returnFromStudio}
      onImportResource={importResource}
      onImportAudio={importSavedAudio}
      shortId={compositionTarget.shortId}
      projectId={compositionTarget.projectId}
      returnToNotifications={reviewOrigin}
      onReturnToShort={returnToJoinedShort}
      onProjectSelected={selectProject}
      onDraftCreated={startDraft}
      onAddLayer={() => { setChoiceError(null); setView("choose"); }}
      onEditTrack={editTrack}
    />;
  }, [returnFromStudio,importSavedAudio,adminCommunity,adminMembers,deleteCommunityPost,openCommunityManagement,sourceAudioStage,workspaceItem,resumeWork,importResource,openSource, sourceTargetId, returnFromCreate, returnFromSearch, creationGalleryId, postTargetStatus, searchCommunity, searchQuery, searchScope, profileUserId, currentUserId, selectedView, sharedShortId, abyssMuted, selectedCommunity, commentPostId, communityTab, authenticate, profileUpdated, startProfileSetup, pendingProfileSetup, go, activeView, compositionTarget, abyssTargetShortId, editorTarget, joinShort, selectProject, returnToJoinedShort, openHomeShort, openSongChart, songChartKind, startDraft, chooseLayer, choiceBusy, choiceError, saveAudio, transformRecording, editTrack, backToStudio, reviewOrigin]);

  // 가입 상태는 커뮤니티 목록·전체목록·상세가 공유하며 서버 구독 API에서 가져온다.
  const creatingProject = activeView === "studio" && compositionTarget.shortId === null && compositionTarget.projectId === null;
  if ((activeView === "studio" && !creatingProject) || activeView === "note") return <DesignViewport landscape>{content}</DesignViewport>;
  const sourcePianoMode = activeView === "createSource" && sourceAudioStage === "note";
  const authView = activeView === "login";
  const onboardingView = Boolean(pendingProfileSetup);
  const noHeader = authView || onboardingView || (activeView==="communityAdmin"&&adminMembers&&commentPostId===null) || sourcePianoMode || activeView === "chat" || (commentPostId === null && (activeView === "search"));
  const footerView = activeView === "joined" || activeView === "communityAdmin" ? "social" : activeView;
  const onBack = commentPostId !== null ? () => setCommentPostId(null)
    : selectedCommunity ? () => setSelectedCommunity(null)
    : activeView === "joined" ? () => go("social")
     : activeView === "opensourceDetail" || activeView === "opensourceComments" ? () => go("opensource") : undefined;
  const workspaceBack = activeView==="importSource"?()=>setView("note"):activeView==="submissionDetail"?()=>go(submissionOrigin==="submissionDetail"?"submissions":submissionOrigin):["submissions","reviewInbox","sourceLibrary"].includes(activeView)?()=>go("settings"):activeView==="workspace"?()=>go("settings"):undefined;
  const headerBack = (activeView==="createSource"&&sourceAudioStage!=="details"?()=>setSourceAudioStage(sourceAudioStage==="choose"?"details":"choose"):undefined) ?? workspaceBack ?? (["createPost","createCommunity","createSource"].includes(activeView)?returnFromCreate:undefined) ?? (["choose", "upload", "record"].includes(activeView) ? () => activeView === "choose" ? backToStudio() : go("choose") : undefined) ?? (activeView==="profile"&&commentPostId===null?returnFromProfile:undefined) ?? (creatingProject ? returnFromStudio : activeView === "posts" || activeView === "charts" ? () => go("home") : activeView === "abyss" ? () => setView(songOrigin) : undefined) ?? onBack ?? (activeView==="communityAdmin"?backFromCommunityAdmin:undefined) ?? (["settings", "saved"].includes(activeView) ? () => go(activeView === "settings" ? "profile" : "settings") : undefined) ?? (activeView === "edit" ? () => {
    if (pendingProfileSetup) setPendingProfileSetup(null);
    go(isAuthenticated ? editOrigin : "login");
  } : undefined);
  return <CommunityMembershipProvider api={membershipApi}><DesignViewport landscape={sourcePianoMode}><div className={`phone-frame${sourcePianoMode ? " phone-frame--source-piano" : ""}`}>{!noHeader && <Header communitySelector={activeView === "createPost" ? <PostCommunityPicker galleries={creationGalleries} value={creationGalleryId} onChange={setCreationGalleryId} /> : undefined} onSettings={(profileUserId === null || profileUserId === currentUserId) && ["profile", "edit", "saved"].includes(activeView) ? () => go("settings") : undefined} abyss={activeView === "abyss"} muted={abyssMuted} onToggleMute={() => setAbyssMuted(current => !current)} onHome={() => go("home")} profileImageUrl={headerProfileImageUrl} onBack={headerBack?()=>navigateBack(headerBack,{logical:true}):undefined} onSearch={() => go("search")} onProfile={() => go(isAuthenticated ? "profile" : "login")} onNotifications={() => go("notifications")} />}<div className="screen-body">{content}</div>{!authView && !onboardingView && !creatingProject && commentPostId === null && activeView !== "chat" && !["createPost","createCommunity","createSource"].includes(activeView) && <Footer view={footerView} go={go} onCreate={openCreate} createLabel={creationLabels[creationForView(activeView,activeView==="search"?searchScope:screenScope(activeView,communityTab,Boolean(selectedCommunity)))]} />}{notificationsOpen && <NotificationsScreen onOpenSubmission={id=>go("submissionDetail",id)} onBack={() => navigateBack(()=>setNotificationsOpen(false),{logical:true})} onOpenFriends={() => go("friends")} onOpenProject={openReviewProject} />}</div></DesignViewport></CommunityMembershipProvider>;
}
