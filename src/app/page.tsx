"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Footer, Header } from "@/components/app/shared";
import type { View } from "@/features/navigation/types";
import { AuthScreen, type PendingProfileSetup } from "@/features/screens/auth-screens";
import { JoinedCommunitiesScreen } from "@/features/screens/community-directory";
import { CommunityMembershipProvider, createServerMembershipApi } from "@/features/screens/community-membership";
import type { CommunityTab } from "@/features/screens/mobile-screens";
import { ChartsScreen, CommunityScreen, HomeScreen, PostsScreen, SearchScreen, type SongChartKind } from "@/features/screens/mobile-screens";
import { ChatConversationScreen, PeopleListScreen } from "@/features/social/social-screens";
import { getFollowRequests, type Person } from "@/lib/api/social";
import { EditProfileScreen, InitialProfileSetupScreen, ProfileScreen } from "@/features/profile/profile-screens";
import { ProfilePostsScreen } from "@/features/profile/profile-posts";
import { AbyssScreen } from "@/features/screens/abyss-screen";
import { NotificationsScreen } from "@/features/screens/notifications-screen";
import { OpensourceScreen, OpensourceDetailScreen } from "@/features/screens/opensource-screens";
import { NoteEditorScreen, StudioScreen } from "@/features/screens/studio-screens";
import { CompositionChoiceScreen, CompositionRecordScreen, CompositionUploadScreen, type CreationMethod } from "@/features/screens/composition-creation-screens";
import { prepareAudioFile, type AudioSelection } from "@/features/composition/prepare-audio-file";
import { createHtiMidiLayerPlan } from "@/features/composition/hti-midi-flow";
import { createAudioClip, createMidiClip, createTrack, getComposition, getContributionInbox, transformRecordingToMidi, uploadMedia } from "@/lib/api/composition";
import { useWebMcpNavigation } from "@/hooks/use-webmcp-navigation";
import { PostCommentsScreen } from "@/features/screens/post-comments";
import { CommunityDetailScreen } from "@/features/screens/community-detail";
import type { Community } from "@/features/screens/community-card";
import { useCurrentUserId } from "@/hooks/use-current-user";
import { getProfile } from "@/lib/api/profile";

// Provider가 api를 의존성으로 보므로 렌더마다 새로 만들지 않는다.
const membershipApi = createServerMembershipApi();

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
  const [abyssMuted, setAbyssMuted] = useState(false);
  const [communityTab, setCommunityTab] = useState<CommunityTab>("posts");
  const [chatFriend, setChatFriend] = useState<Person | null>(null);
  const [profileTargetId, setProfileTargetId] = useState<number | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [commentPostId, setCommentPostId] = useState<number | null>(null);
  const [songChartKind, setSongChartKind] = useState<SongChartKind>("popular");
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
    if (next === "friends") setCommunityTab("friends");
    if (next === "community") setCommunityTab("community");
    setView(next === "friends" || next === "community" ? "social" : next);
  }, []);

  const openChat = useCallback((person: Person) => { setChatFriend(person); setView("chat"); }, []);
  const openPersonProfile = useCallback((person: Person) => { setProfileTargetId(person.userId); setView("profile"); }, []);

  useEffect(() => {
    if (currentUserId == null) return;
    let alive = true;
    const refresh = async () => {
      const [contributions, follows] = await Promise.allSettled([getContributionInbox(), getFollowRequests()]);
      if (alive) setNotificationCount((contributions.status === "fulfilled" ? contributions.value.length : 0) + (follows.status === "fulfilled" ? follows.value.length : 0));
    };
    void refresh();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void refresh(); }, 30000);
    window.addEventListener("social-notifications-changed", refresh);
    return () => { alive = false; window.clearInterval(timer); window.removeEventListener("social-notifications-changed", refresh); };
  }, [currentUserId]);

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

  const openHomeShort = useCallback((shortId: number) => {
    setAbyssTargetShortId(shortId);
    setView("abyss");
  }, []);

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
    if (activeView === "home") return <HomeScreen go={go} onOpenPost={setCommentPostId} onOpenShort={openHomeShort} onShowSongs={openSongChart} />;
    if (activeView === "abyss") return <AbyssScreen onJoin={joinShort} initialShortId={abyssTargetShortId} muted={abyssMuted} />;
    if (activeView === "notifications") return <NotificationsScreen onBack={() => go("home")} onOpenProject={openReviewProject} />;
    if (activeView === "charts") return <ChartsScreen go={go} kind={songChartKind} onOpenShort={openHomeShort} />;
    if (activeView === "posts") return <PostsScreen go={go} onOpenPost={setCommentPostId} />;
    if (activeView === "mutual" || activeView === "recommendations" || activeView === "followers" || activeView === "following") return <PeopleListScreen kind={activeView} onChat={openChat} onProfile={openPersonProfile} />;
    if (activeView === "chat" && chatFriend) return <ChatConversationScreen friend={chatFriend} onBack={() => go("mutual")} onNotifications={() => go("notifications")} onSearch={() => go("search")} />;
    if (activeView === "search") return <SearchScreen go={go} />;
    if (activeView === "social" || activeView === "community") return <CommunityScreen go={go} tab={communityTab} onTabChange={setCommunityTab} onComments={setCommentPostId} onOpenCommunity={setSelectedCommunity} onChat={openChat} onProfile={openPersonProfile} />;
    if (activeView === "opensource") return <OpensourceScreen go={go} />;
    if (activeView === "opensourceDetail") return <OpensourceDetailScreen />;
    if (activeView === "opensourceComments") return <OpensourceDetailScreen focusComments />;
    if (activeView === "joined") return <JoinedCommunitiesScreen onOpen={setSelectedCommunity} />;
    if (activeView === "profile") return <ProfileScreen go={go} targetUserId={profileTargetId} />;
    if (activeView === "savedPosts" || activeView === "likedPosts") return <ProfilePostsScreen kind={activeView} onOpen={setCommentPostId} />;
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
  }, [abyssMuted, selectedCommunity, commentPostId, communityTab, authenticate, profileUpdated, startProfileSetup, pendingProfileSetup, go, activeView, compositionTarget, abyssTargetShortId, editorTarget, joinShort, selectProject, returnToJoinedShort, openHomeShort, openSongChart, songChartKind, startDraft, chooseLayer, choiceBusy, choiceError, saveAudio, transformRecording, editTrack, backToStudio, openReviewProject, reviewOrigin, openChat, openPersonProfile, chatFriend, profileTargetId]);

  // 가입 상태는 커뮤니티 목록·전체목록·상세가 공유하며 서버 구독 API에서 가져온다.
  if (activeView === "studio" || activeView === "note") return <main className="studio-shell">{content}</main>;
  const authView = activeView === "login";
  const onboardingView = Boolean(pendingProfileSetup);
  const noHeader = authView || onboardingView || activeView === "chat" || (commentPostId === null && (activeView === "charts" || activeView === "posts" || activeView === "search"));
  const footerView = activeView === "joined" ? "social" : activeView;
  const onBack = commentPostId !== null ? () => setCommentPostId(null)
    : selectedCommunity ? () => setSelectedCommunity(null)
    : activeView === "mutual" || activeView === "recommendations" ? () => go("friends")
    : activeView === "followers" || activeView === "following" ? () => go("profile")
    : activeView === "savedPosts" || activeView === "likedPosts" ? () => go("profile")
    : activeView === "profile" && profileTargetId !== null ? () => { setProfileTargetId(null); go("friends"); }
    : activeView === "joined" ? () => go("social")
     : activeView === "opensourceDetail" || activeView === "opensourceComments" ? () => go("opensource") : undefined;
  const headerBack = onBack ?? (activeView === "edit" ? () => {
    if (pendingProfileSetup) setPendingProfileSetup(null);
    go(isAuthenticated ? "profile" : "login");
  } : undefined);
  const ownProfileView = activeView === "profile" && isAuthenticated && (profileTargetId === null || profileTargetId === currentUserId);
  return <CommunityMembershipProvider api={membershipApi}><main className="page-background"><div className="phone-frame">{!noHeader && <Header notificationCount={isAuthenticated ? notificationCount : 0} hideProfileAction={ownProfileView} hideSearchAction={ownProfileView} abyss={activeView === "abyss"} muted={abyssMuted} onToggleMute={() => setAbyssMuted(current => !current)} onHome={() => go("home")} profileImageUrl={headerProfileImageUrl} onBack={headerBack} onSearch={() => go("search")} onProfile={() => { setProfileTargetId(null); go(isAuthenticated ? "profile" : "login"); }} onNotifications={() => go("notifications")} />}<div className="screen-body">{content}</div>{!authView && !onboardingView && activeView !== "chat" && <Footer view={footerView} go={go} />}</div></main></CommunityMembershipProvider>;
}
