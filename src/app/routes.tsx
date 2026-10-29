import type { ComponentType } from "react";
import { createBrowserRouter, type RouteObject } from "react-router";
import { AppProviders } from "./session";
import AppLayout from "@/layouts/app-layout";
import { RequireAuth } from "@/features/auth/require-auth";
import { pageRoutes, type PageId, type PageRoute } from "@/features/navigation/route-config";
import NotFoundPage from "@/pages/not-found-page";
import HomePage from "@/pages/home-page";
import AbyssPage from "@/pages/abyss-page";
import ChartsPage from "@/pages/charts-page";
import PostsPage from "@/pages/posts-page";
import PostPage from "@/pages/post-page";
import CreatePostPage from "@/pages/create-post-page";
import SocialPage from "@/pages/social-page";
import JoinedPage from "@/pages/joined-page";
import CreateCommunityPage from "@/pages/create-community-page";
import CommunityPage from "@/pages/community-page";
import CommunityAdminPage from "@/pages/community-admin-page";
import SourcesPage from "@/pages/sources-page";
import SourcePage from "@/pages/source-page";
import CreateSourcePage from "@/pages/create-source-page";
import SearchPage from "@/pages/search-page";
import ProfilePage from "@/pages/profile-page";
import EditProfilePage from "@/pages/edit-profile-page";
import LoginPage from "@/pages/login-page";
import OnboardingPage from "@/pages/onboarding-page";
import SettingsPage from "@/pages/settings-page";
import SavedPage from "@/pages/saved-page";
import WorkspacePage from "@/pages/workspace-page";
import SubmissionsPage from "@/pages/submissions-page";
import SubmissionPage from "@/pages/submission-page";
import ReviewsPage from "@/pages/reviews-page";
import LibraryPage from "@/pages/library-page";
import StudioNewPage from "@/pages/studio-new-page";
import StudioPage from "@/pages/studio-page";
import LayerChoicePage from "@/pages/layer-choice-page";
import UploadPage from "@/pages/upload-page";
import RecordPage from "@/pages/record-page";
import NoteEditorPage from "@/pages/note-editor-page";
import ChatPage from "@/pages/chat-page";
import NotificationsPage from "@/pages/notifications-page";
import AdminPage from "@/pages/admin-page";

const pageComponents: Record<PageId, ComponentType> = {
  home: HomePage,
  abyss: AbyssPage,
  short: AbyssPage,
  charts: ChartsPage,
  posts: PostsPage,
  post: PostPage,
  createPost: CreatePostPage,
  social: SocialPage,
  communities: SocialPage,
  friends: SocialPage,
  joined: JoinedPage,
  createCommunity: CreateCommunityPage,
  community: CommunityPage,
  communityPost: PostPage,
  communityAdmin: CommunityAdminPage,
  communityMembers: CommunityAdminPage,
  ownedCommunities: CommunityAdminPage,
  sources: SourcesPage,
  source: SourcePage,
  sourceComments: SourcePage,
  createSource: CreateSourcePage,
  search: SearchPage,
  profile: ProfilePage,
  user: ProfilePage,
  editProfile: EditProfilePage,
  login: LoginPage,
  onboarding: OnboardingPage,
  settings: SettingsPage,
  saved: SavedPage,
  workspace: WorkspacePage,
  submissions: SubmissionsPage,
  submission: SubmissionPage,
  reviews: ReviewsPage,
  library: LibraryPage,
  studioNew: StudioNewPage,
  studio: StudioPage,
  joinShort: StudioPage,
  choose: LayerChoicePage,
  upload: UploadPage,
  record: RecordPage,
  notes: NoteEditorPage,
  import: LibraryPage,
  chat: ChatPage,
  notifications: NotificationsPage,
  admin: AdminPage,
};

function appPages(): RouteObject[] {
  return pageRoutes.map((route): RouteObject => {
    const Component = pageComponents[route.id];
    const page: PageRoute = route;
    const element = page.requiresAuth ? <RequireAuth><Component /></RequireAuth> : <Component />;
    return { ...(route.path ? { path: route.path } : { index: true }), element, handle: page };
  });
}

function appChildren(): RouteObject[] {
  return [
    { element: <AppLayout />, children: appPages() },
    { path: "*", element: <NotFoundPage /> },
  ];
}

export const router = createBrowserRouter([
  { path: "/", element: <AppProviders />, children: appChildren() },
]);
