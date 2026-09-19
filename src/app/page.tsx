"use client";

import { useCallback, useMemo, useState } from "react";
import { Footer, Header } from "@/components/app/shared";
import type { View } from "@/features/navigation/types";
import { AuthScreen } from "@/features/screens/auth-screens";
import { AbyssScreen, ChartsScreen, CommunityScreen, EditProfileScreen, FriendsScreen, HomeScreen, PostsScreen, ProfileScreen, SearchScreen } from "@/features/screens/mobile-screens";
import { NoteEditorScreen, StudioScreen } from "@/features/screens/studio-screens";
import { useWebMcpNavigation } from "@/hooks/use-webmcp-navigation";

export default function Page() {
  const [view, setView] = useState<View>("home");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const go = useCallback((next: View) => setView(next), []);
  const authenticate = useCallback(() => {
    setIsAuthenticated(true);
    setView("home");
  }, []);
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
    if (view === "login" || view === "signup") return <AuthScreen mode={view} go={go} onAuthenticate={authenticate} />;
    if (view === "edit") return <EditProfileScreen />;
    if (view === "note") return <NoteEditorScreen go={go} />;
    return <StudioScreen go={go} />;
  }, [authenticate, go, view]);

  if (view === "studio" || view === "note") return <main className="studio-shell">{content}</main>;
  const authView = view === "login" || view === "signup";
  const noHeader = authView || view === "charts" || view === "posts" || view === "search";
  return <main className="page-background"><div className="phone-frame">{!noHeader && <Header blank={view === "friends"} abyss={view === "abyss"} onSearch={() => go("search")} onProfile={() => go(isAuthenticated ? "profile" : "login")} />}<div className="screen-body">{content}</div>{!authView && <Footer view={view} go={go} />}</div></main>;
}
