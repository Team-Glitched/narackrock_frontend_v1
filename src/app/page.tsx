"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Footer, Header } from "@/components/app/shared";
import type { View } from "@/features/navigation/types";
import { AuthScreen, type PendingProfileSetup } from "@/features/screens/auth-screens";
import { defaultJoinedCommunityIds, JoinedCommunitiesScreen } from "@/features/screens/community-directory";
import { CommunityMembershipProvider } from "@/features/screens/community-membership";
import type { CommunityTab } from "@/features/screens/mobile-screens";
import { ChartsScreen, CommunityScreen, FriendsScreen, HomeScreen, PostsScreen, SearchScreen } from "@/features/screens/mobile-screens";
import { EditProfileScreen, InitialProfileSetupScreen, ProfileScreen } from "@/features/profile/profile-screens";
import { AbyssScreen } from "@/features/screens/abyss-screen";
import { NotificationsScreen } from "@/features/screens/notifications-screen";
import { NoteEditorScreen, StudioScreen } from "@/features/screens/studio-screens";
import { CompositionChoiceScreen, CompositionRecordScreen, CompositionUploadScreen, type CreationMethod } from "@/features/screens/composition-creation-screens";
import { prepareAudioFile, type AudioSelection } from "@/features/composition/prepare-audio-file";
import { createHtiMidiLayerPlan } from "@/features/composition/hti-midi-flow";
import { createAudioClip, createMidiClip, createTrack, getComposition, transformRecordingToMidi, uploadMedia } from "@/lib/api/composition";
import { useWebMcpNavigation } from "@/hooks/use-webmcp-navigation";
import { PostCommentsScreen } from "@/features/screens/post-comments";
import { CommunityDetailScreen } from "@/features/screens/community-detail";
import type { Community } from "@/features/screens/community-card";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { getProfile } from "@/lib/api/profile";

export default function Page() {
  const [view, setView] = useState<View>("home");
  const currentUserId = useCurrentUserId();
  const isAuthenticated = currentUserId !== null;
  const [headerProfile, setHeaderProfile] = useState<{ userId: number; imageUrl: string | null } | null>(null);
  const [profileRevision, setProfileRevision] = useState(0);
  const headerProfileImageUrl = currentUserId !== null && headerProfile?.userId === currentUserId
    ? headerProfile.imageUrl
    : null;
  const [pendingProfileSetup, setPendingProfileSetup] = useState<PendingProfileSetup | null>(null);
  const activeView: View = currentUserId === null
    && pendingProfileSetup === null
    && (view === "profile" || view === "edit")
    ? "login"
    : view;
  const [communityTab, setCommunityTab] = useState<CommunityTab>("posts");
  const [commentPostId, setCommentPostId] = useState<number | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const [compositionTarget, setCompositionTarget] = useState<{ shortId: number | null; projectId: number | null }>({ shortId: null, projectId: null });
  const [abyssTargetShortId, setAbyssTargetShortId] = useState<number | null>(null);
  const [editorTarget, setEditorTarget] = useState<{ trackId: number; clipId: number | null } | null>(null);
  const [reviewOrigin, setReviewOrigin] = useState(false);
  const [choiceBusy, setChoiceBusy] = useState(false);
  const [choiceError, setChoiceError] = useState<string | null>(null);
  const go = useCallback((next: View) => {
    setCommentPostId(null);
    setSelectedCommunity(null);
    if (next === "studio") setCompositionTarget({ shortId: null, projectId: null });
    if (next === "abyss") setAbyssTargetShortId(null);
    setView(next);
  }, []);
  const authenticate = useCallback(() => {
    setPendingProfileSetup(null);
    setProfileRevision(current => current + 1);
    setView("home");
  }, []);
  const profileUpdated = useCallback(() => {
    setProfileRevision(current => current + 1);
    go("profile");
  }, [go]);
  const startProfileSetup = useCallback((pending: PendingProfileSetup) => {
    setPendingProfileSetup(pending);
    setView("edit");
  }, []);
  const joinShort = useCallback((shortId: number) => {
    setReviewOrigin(false);
    setCompositionTarget({ shortId, projectId: null });
    setView("studio");
  }, []);
  const selectProject = useCallback((projectId: number) => setCompositionTarget((current) => ({ ...current, projectId })), []);
  const returnToJoinedShort = useCallback((shortId: number) => {
    setAbyssTargetShortId(shortId);
    setView("abyss");
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
  const backToStudio = useCallback(() => setView("studio"), []);
  const openReviewProject = useCallback((projectId: number) => {
    setReviewOrigin(true);
    setCompositionTarget({ shortId: null, projectId });
    setView("studio");
  }, []);
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

  const content = useMemo(() => {
    if (commentPostId !== null) return <PostCommentsScreen key={commentPostId} postId={commentPostId} />;
    if (selectedCommunity) return <CommunityDetailScreen key={selectedCommunity.id} community={selectedCommunity} onComments={setCommentPostId} />;
    if (activeView === "home") return <HomeScreen go={go} onOpenPost={setCommentPostId} />;
    if (activeView === "abyss") return <AbyssScreen onJoin={joinShort} initialShortId={abyssTargetShortId} />;
    if (activeView === "notifications") return <NotificationsScreen onBack={() => go("home")} onOpenProject={openReviewProject} />;
    if (activeView === "charts") return <ChartsScreen go={go} />;
    if (activeView === "posts") return <PostsScreen go={go} onOpenPost={setCommentPostId} />;
    if (activeView === "friends") return <FriendsScreen />;
    if (activeView === "search") return <SearchScreen go={go} />;
    if (activeView === "community") return <CommunityScreen go={go} tab={communityTab} onTabChange={setCommunityTab} onComments={setCommentPostId} onOpenCommunity={setSelectedCommunity} />;
    if (activeView === "joined") return <JoinedCommunitiesScreen onOpen={setSelectedCommunity} />;
    if (activeView === "profile") return <ProfileScreen go={go} />;
    if (activeView === "login") return <AuthScreen onAuthenticated={authenticate} onFirstLogin={startProfileSetup} />;
    if (activeView === "edit" && pendingProfileSetup) return <InitialProfileSetupScreen {...pendingProfileSetup} onSaved={authenticate} />;
    if (activeView === "edit") return <EditProfileScreen onSaved={profileUpdated} />;
    if (activeView === "choose") return <CompositionChoiceScreen onChoose={(method) => { void chooseLayer(method); }}
      onBack={() => setView("studio")} busy={choiceBusy} error={choiceError} />;
    if (activeView === "upload") return <CompositionUploadScreen onSave={saveAudio} onBack={() => setView("choose")} />;
    if (activeView === "record") return <CompositionRecordScreen onSave={saveAudio} onTransform={transformRecording} onBack={() => setView("choose")} />;
    if (activeView === "note") return <NoteEditorScreen
      projectId={compositionTarget.projectId}
      trackId={editorTarget?.trackId ?? null}
      clipId={editorTarget?.clipId ?? null}
      onBack={backToStudio}
      onAddLayer={() => { setChoiceError(null); setView("choose"); }}
    />;
    return <StudioScreen
      go={go}
      shortId={compositionTarget.shortId}
      projectId={compositionTarget.projectId}
      returnToNotifications={reviewOrigin}
      onReturnToShort={returnToJoinedShort}
      onProjectSelected={selectProject}
      onDraftCreated={startDraft}
      onAddLayer={() => { setChoiceError(null); setView("choose"); }}
      onEditTrack={editTrack}
    />;
  }, [selectedCommunity, commentPostId, communityTab, authenticate, profileUpdated, startProfileSetup, pendingProfileSetup, go, activeView, compositionTarget, abyssTargetShortId, editorTarget, joinShort, selectProject, returnToJoinedShort, startDraft, chooseLayer, choiceBusy, choiceError, saveAudio, transformRecording, editTrack, backToStudio, openReviewProject, reviewOrigin]);

  // 가입 상태는 커뮤니티 목록·전체목록·상세가 공유한다.
  // 실제 구독 API가 준비되면 Provider에 api prop만 넘기면 된다.
  if (activeView === "studio" || activeView === "note") return <main className="studio-shell">{content}</main>;
  const authView = activeView === "login";
  const onboardingView = Boolean(pendingProfileSetup);
  const noHeader = authView || onboardingView || (commentPostId === null && (activeView === "charts" || activeView === "posts" || activeView === "search"));
  // 가입한 커뮤니티 목록은 커뮤니티 탭의 하위 화면이라 푸터는 커뮤니티를 계속 활성으로 둔다.
  const footerView = activeView === "joined" ? "community" : activeView;
  const onBack = commentPostId !== null ? () => setCommentPostId(null)
    : selectedCommunity ? () => setSelectedCommunity(null)
    : activeView === "joined" ? () => go("community") : undefined;
  const headerBack = onBack ?? (activeView === "edit" ? () => {
    if (pendingProfileSetup) setPendingProfileSetup(null);
    go(isAuthenticated ? "profile" : "login");
  } : undefined);
  return <CommunityMembershipProvider defaultJoinedIds={defaultJoinedCommunityIds}><main className="page-background"><div className="phone-frame">{!noHeader && <Header blank={activeView === "friends"} abyss={activeView === "abyss"} profileImageUrl={headerProfileImageUrl} onBack={headerBack} onSearch={() => go("search")} onProfile={() => go(isAuthenticated ? "profile" : "login")} onNotifications={() => go("notifications")} />}<div className="screen-body">{content}</div>{!authView && !onboardingView && <Footer view={footerView} go={go} />}</div></main></CommunityMembershipProvider>;
}
