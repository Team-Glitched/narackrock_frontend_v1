"use client";

import { useCallback, useMemo, useState } from "react";
import { Footer, Header } from "@/components/app/shared";
import type { View } from "@/features/navigation/types";
import { defaultJoinedCommunityIds, JoinedCommunitiesScreen } from "@/features/screens/community-directory";
import { CommunityMembershipProvider } from "@/features/screens/community-membership";
import type { CommunityTab } from "@/features/screens/mobile-screens";
import { AbyssScreen, ChartsScreen, CommunityScreen, EditProfileScreen, FriendsScreen, HomeScreen, PostsScreen, ProfileScreen, SearchScreen } from "@/features/screens/mobile-screens";
import { NoteEditorScreen, StudioScreen } from "@/features/screens/studio-screens";
import { useWebMcpNavigation } from "@/hooks/use-webmcp-navigation";
import { PostCommentsScreen } from "@/features/screens/post-comments";
import { CommunityDetailScreen } from "@/features/screens/community-detail";
import type { Community } from "@/features/screens/community-card";

export default function Page() {
  const [view, setView] = useState<View>("home");
  const [communityTab, setCommunityTab] = useState<CommunityTab>("posts");
  const [commentPostId, setCommentPostId] = useState<number | null>(null);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(null);
  const go = useCallback((next: View) => { setCommentPostId(null); setSelectedCommunity(null); setView(next); }, []);
  useWebMcpNavigation(go);

  const content = useMemo(() => {
    if (commentPostId !== null) return <PostCommentsScreen key={commentPostId} postId={commentPostId} />;
    if (selectedCommunity) return <CommunityDetailScreen key={selectedCommunity.id} community={selectedCommunity} onComments={setCommentPostId} />;
    if (view === "home") return <HomeScreen go={go} />;
    if (view === "abyss") return <AbyssScreen go={go} />;
    if (view === "charts") return <ChartsScreen go={go} />;
    if (view === "posts") return <PostsScreen go={go} />;
    if (view === "friends") return <FriendsScreen />;
    if (view === "search") return <SearchScreen go={go} />;
    if (view === "community") return <CommunityScreen go={go} tab={communityTab} onTabChange={setCommunityTab} onComments={setCommentPostId} onOpenCommunity={setSelectedCommunity} />;
    if (view === "joined") return <JoinedCommunitiesScreen onOpen={setSelectedCommunity} />;
    if (view === "profile") return <ProfileScreen go={go} />;
    if (view === "edit") return <EditProfileScreen />;
    if (view === "note") return <NoteEditorScreen go={go} />;
    return <StudioScreen go={go} />;
  }, [selectedCommunity, commentPostId, communityTab, go, view]);

  // 가입 상태는 커뮤니티 목록·전체목록·상세가 공유한다.
  // 실제 구독 API가 준비되면 Provider에 api prop만 넘기면 된다.
  if (view === "studio" || view === "note") return <main className="studio-shell">{content}</main>;
  const noHeader = view === "charts" || view === "posts" || view === "search";
  // 가입한 커뮤니티 목록은 커뮤니티 탭의 하위 화면이라 푸터는 커뮤니티를 계속 활성으로 둔다.
  const footerView = view === "joined" ? "community" : view;
  const onBack = commentPostId !== null ? () => setCommentPostId(null)
    : selectedCommunity ? () => setSelectedCommunity(null)
    : view === "joined" ? () => go("community") : undefined;
  return <CommunityMembershipProvider defaultJoinedIds={defaultJoinedCommunityIds}><main className="page-background"><div className="phone-frame">{!noHeader && <Header blank={view === "friends"} abyss={view === "abyss"} onBack={onBack} onSearch={() => go("search")} onProfile={() => go("profile")} />}<div className="screen-body">{content}</div><Footer view={footerView} go={go} /></div></main></CommunityMembershipProvider>;
}
