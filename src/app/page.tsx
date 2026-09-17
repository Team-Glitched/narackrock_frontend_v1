"use client";

import { useCallback, useMemo, useState } from "react";
import { Footer, Header } from "@/components/app/shared";
import type { View } from "@/features/navigation/types";
import { ChartsScreen, CommunityScreen, EditProfileScreen, FriendsScreen, HomeScreen, PostsScreen, ProfileScreen, SearchScreen } from "@/features/screens/mobile-screens";
import { AbyssScreen } from "@/features/screens/abyss-screen";
import { NoteEditorScreen, StudioScreen } from "@/features/screens/studio-screens";
import { useWebMcpNavigation } from "@/hooks/use-webmcp-navigation";

export default function Page() {
  const [view, setView] = useState<View>("home");
  const [compositionTarget, setCompositionTarget] = useState<{ shortId: number | null; projectId: number | null }>({ shortId: null, projectId: null });
  const [editorTarget, setEditorTarget] = useState<{ trackId: number; clipId: number | null } | null>(null);
  const go = useCallback((next: View) => {
    if (next === "studio") setCompositionTarget({ shortId: null, projectId: null });
    setView(next);
  }, []);
  const joinShort = useCallback((shortId: number) => {
    setCompositionTarget({ shortId, projectId: null });
    setView("studio");
  }, []);
  const selectProject = useCallback((projectId: number) => setCompositionTarget((current) => ({ ...current, projectId })), []);
  const editTrack = useCallback((trackId: number, clipId: number | null) => {
    setEditorTarget({ trackId, clipId });
    setView("note");
  }, []);
  const backToStudio = useCallback(() => setView("studio"), []);
  useWebMcpNavigation(go);

  const content = useMemo(() => {
    if (view === "home") return <HomeScreen go={go} />;
    if (view === "abyss") return <AbyssScreen onJoin={joinShort} />;
    if (view === "charts") return <ChartsScreen go={go} />;
    if (view === "posts") return <PostsScreen go={go} />;
    if (view === "friends") return <FriendsScreen />;
    if (view === "search") return <SearchScreen go={go} />;
    if (view === "community") return <CommunityScreen />;
    if (view === "profile") return <ProfileScreen go={go} />;
    if (view === "edit") return <EditProfileScreen />;
    if (view === "note") return <NoteEditorScreen
      projectId={compositionTarget.projectId}
      trackId={editorTarget?.trackId ?? null}
      clipId={editorTarget?.clipId ?? null}
      onBack={backToStudio}
    />;
    return <StudioScreen
      go={go}
      shortId={compositionTarget.shortId}
      projectId={compositionTarget.projectId}
      onProjectSelected={selectProject}
      onEditTrack={editTrack}
    />;
  }, [go, view, compositionTarget, editorTarget, joinShort, selectProject, editTrack, backToStudio]);

  if (view === "studio" || view === "note") return <main className="studio-shell">{content}</main>;
  const noHeader = view === "charts" || view === "posts" || view === "search";
  return <main className="page-background"><div className="phone-frame">{!noHeader && <Header blank={view === "friends"} abyss={view === "abyss"} onSearch={() => go("search")} onProfile={() => go("profile")} />}<div className="screen-body">{content}</div><Footer view={view} go={go} /></div></main>;
}
