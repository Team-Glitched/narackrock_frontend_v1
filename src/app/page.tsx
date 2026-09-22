"use client";

import { useCallback, useMemo, useState } from "react";
import { Footer, Header } from "@/components/app/shared";
import type { View } from "@/features/navigation/types";
import { AuthScreen } from "@/features/screens/auth-screens";
import { JoinedCommunitiesScreen } from "@/features/screens/community-directory";
import { CommunityMembershipProvider, createServerMembershipApi } from "@/features/screens/community-membership";
import type { CommunityTab } from "@/features/screens/mobile-screens";
import { ChartsScreen, CommunityScreen, EditProfileScreen, FriendsScreen, HomeScreen, PostsScreen, ProfileScreen, SearchScreen } from "@/features/screens/mobile-screens";
import { AbyssScreen } from "@/features/screens/abyss-screen";
import { NotificationsScreen } from "@/features/screens/notifications-screen";
import { NoteEditorScreen, StudioScreen } from "@/features/screens/studio-screens";
import { CompositionChoiceScreen, CompositionRecordScreen, CompositionUploadScreen, type CreationMethod } from "@/features/screens/composition-creation-screens";
import { prepareAudioFile, type AudioSelection } from "@/features/composition/prepare-audio-file";
import { createAudioClip, createTrack, getComposition, uploadMedia } from "@/lib/api/composition";
import { useWebMcpNavigation } from "@/hooks/use-webmcp-navigation";
import { PostCommentsScreen } from "@/features/screens/post-comments";
import { CommunityDetailScreen } from "@/features/screens/community-detail";
import type { Community } from "@/features/screens/community-card";

// Provider가 api를 의존성으로 보므로 렌더마다 새로 만들면 목록을 계속 다시 받는다.
const membershipApi = createServerMembershipApi();

export default function Page() {
  const [view, setView] = useState<View>("home");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
  const authenticate = useCallback(() => { setIsAuthenticated(true); setView("home"); }, []);
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
  useWebMcpNavigation(go);

  const content = useMemo(() => {
    if (commentPostId !== null) return <PostCommentsScreen key={commentPostId} postId={commentPostId} />;
    if (selectedCommunity) return <CommunityDetailScreen key={selectedCommunity.id} community={selectedCommunity} onComments={setCommentPostId} />;
    if (view === "home") return <HomeScreen go={go} />;
    if (view === "abyss") return <AbyssScreen onJoin={joinShort} initialShortId={abyssTargetShortId} />;
    if (view === "notifications") return <NotificationsScreen onBack={() => go("home")} onOpenProject={openReviewProject} />;
    if (view === "charts") return <ChartsScreen go={go} />;
    if (view === "posts") return <PostsScreen go={go} />;
    if (view === "friends") return <FriendsScreen />;
    if (view === "search") return <SearchScreen go={go} />;
    if (view === "community") return <CommunityScreen go={go} tab={communityTab} onTabChange={setCommunityTab} onComments={setCommentPostId} onOpenCommunity={setSelectedCommunity} />;
    if (view === "joined") return <JoinedCommunitiesScreen onOpen={setSelectedCommunity} />;
    if (view === "profile") return <ProfileScreen go={go} />;
    if (view === "login" || view === "signup") return <AuthScreen mode={view} go={go} onAuthenticate={authenticate} />;
    if (view === "edit") return <EditProfileScreen />;
    if (view === "choose") return <CompositionChoiceScreen onChoose={(method) => { void chooseLayer(method); }}
      onBack={() => setView("studio")} busy={choiceBusy} error={choiceError} />;
    if (view === "upload") return <CompositionUploadScreen onSave={saveAudio} onBack={() => setView("choose")} />;
    if (view === "record") return <CompositionRecordScreen onSave={saveAudio} onBack={() => setView("choose")} />;
    if (view === "note") return <NoteEditorScreen
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
  }, [selectedCommunity, commentPostId, communityTab, authenticate, go, view, compositionTarget, abyssTargetShortId, editorTarget, joinShort, selectProject, returnToJoinedShort, startDraft, chooseLayer, choiceBusy, choiceError, saveAudio, editTrack, backToStudio, openReviewProject, reviewOrigin]);

  // 가입 상태는 커뮤니티 목록·전체목록·상세가 공유한다 — 갤러리 구독 API로 연동돼 있다.
  if (view === "studio" || view === "note") return <main className="studio-shell">{content}</main>;
  const authView = view === "login" || view === "signup";
  const noHeader = authView || view === "charts" || view === "posts" || view === "search";
  // 가입한 커뮤니티 목록은 커뮤니티 탭의 하위 화면이라 푸터는 커뮤니티를 계속 활성으로 둔다.
  const footerView = view === "joined" ? "community" : view;
  const onBack = commentPostId !== null ? () => setCommentPostId(null)
    : selectedCommunity ? () => setSelectedCommunity(null)
    : view === "joined" ? () => go("community") : undefined;
  // 가입 상태는 이제 서버(갤러리 구독 API)에서 온다 — 예시 기본값(defaultJoinedCommunityIds)은 사라졌다.
  // 헤더·푸터의 로그인 분기는 main(PR #17·#19)에서 온 것을 그대로 유지한다.
  return <CommunityMembershipProvider api={membershipApi}><main className="page-background"><div className="phone-frame">{!noHeader && <Header blank={view === "friends"} abyss={view === "abyss"} onBack={onBack} onSearch={() => go("search")} onProfile={() => go(isAuthenticated ? "profile" : "login")} onNotifications={() => go("notifications")} />}<div className="screen-body">{content}</div>{!authView && <Footer view={footerView} go={go} />}</div></main></CommunityMembershipProvider>;
}
