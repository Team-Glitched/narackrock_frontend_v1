"use client";

import { useCallback, useMemo, useState } from "react";
import { Footer, Header } from "@/components/app/shared";
import type { View } from "@/features/navigation/types";
import { AbyssScreen, ChartsScreen, CommunityScreen, EditProfileScreen, FriendsScreen, HomeScreen, PostsScreen, ProfileScreen, SearchScreen } from "@/features/screens/mobile-screens";
import { NoteEditorScreen, StudioScreen } from "@/features/screens/studio-screens";
import { useWebMcpNavigation } from "@/hooks/use-webmcp-navigation";

export default function Page() {
  const [view, setView] = useState<View>("home");
  const go = useCallback((next: View) => setView(next), []);
  useWebMcpNavigation(go);

  const content = useMemo(() => {
    if (view === "home") return <HomeScreen go={go} />;
    if (view === "abyss") return <AbyssScreen go={go} />;
    if (view === "charts") return <ChartsScreen go={go} />;
    if (view === "posts") return <PostsScreen go={go} />;
    if (view === "friends") return <FriendsScreen />;
    if (view === "search") return <SearchScreen go={go} />;
    if (view === "community") return <CommunityScreen />;
    if (view === "profile") return <ProfileScreen go={go} />;
    if (view === "edit") return <EditProfileScreen />;
    if (view === "note") return <NoteEditorScreen go={go} />;
    return <StudioScreen go={go} />;
  }, [go, view]);

  if (view === "studio" || view === "note") return <main className="studio-shell">{content}</main>;
  const noHeader = view === "charts" || view === "posts" || view === "search";
  return <main className="page-background"><div className="phone-frame">{!noHeader && <Header blank={view === "friends"} abyss={view === "abyss"} onSearch={() => go("search")} onProfile={() => go("profile")} />}<div className="screen-body">{content}</div><Footer view={view} go={go} /></div></main>;
}
