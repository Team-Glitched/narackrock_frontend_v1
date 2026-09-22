"use client";

import { useCallback, useMemo, useState } from "react";
import { Footer, Header } from "@/components/app/shared";
import type { View } from "@/features/navigation/types";
import {
  AbyssScreen,
  ChartsScreen,
  EditProfileScreen,
  HomeScreen,
  OpensourceDetailScreen,
  OpensourceScreen,
  PostDetailScreen,
  PostsScreen,
  ProfileScreen,
  SearchScreen,
  SocialScreen,
} from "@/features/screens/mobile-screens";
import {
  NoteEditorScreen,
  StudioScreen,
} from "@/features/screens/studio-screens";
import { useWebMcpNavigation } from "@/hooks/use-webmcp-navigation";

export default function Page() {
  const [view, setView] = useState<View>("home");
  const [abyssMuted, setAbyssMuted] = useState(false);
  const go = useCallback((next: View) => setView(next), []);
  useWebMcpNavigation(go);

  const content = useMemo(() => {
    if (view === "home") return <HomeScreen go={go} />;
    if (view === "abyss") return <AbyssScreen go={go} />;
    if (view === "charts") return <ChartsScreen go={go} />;
    if (view === "posts") return <PostsScreen go={go} />;
    if (view === "post") return <PostDetailScreen go={go} />;
    if (view === "social") return <SocialScreen go={go} />;
    if (view === "search") return <SearchScreen go={go} />;
    if (view === "opensource") return <OpensourceScreen go={go} />;
    if (view === "opensourceDetail") return <OpensourceDetailScreen />;
    if (view === "opensourceComments") return <OpensourceDetailScreen focusComments />;
    if (view === "profile") return <ProfileScreen go={go} />;
    if (view === "edit") return <EditProfileScreen />;
    if (view === "note") return <NoteEditorScreen go={go} />;
    return <StudioScreen go={go} />;
  }, [go, view]);

  if (view === "studio" || view === "note")
    return <main className="studio-shell">{content}</main>;
  const noHeader = view === "charts" || view === "posts" || view === "search";
  return (
    <main className="page-background">
      <div className="phone-frame">
        {!noHeader && (
          <Header
            abyss={view === "abyss"}
            back={view === "post" || view === "opensourceDetail" || view === "opensourceComments"}
            onBack={() => go(view === "opensourceDetail" || view === "opensourceComments" ? "opensource" : "home")}
            muted={abyssMuted}
            onToggleMute={() => setAbyssMuted((current) => !current)}
            onHome={() => go("home")}
            onSearch={() => go("search")}
            onProfile={() => go("profile")}
          />
        )}
        <div className="screen-body">{content}</div>
        <Footer view={view} go={go} />
      </div>
    </main>
  );
}
