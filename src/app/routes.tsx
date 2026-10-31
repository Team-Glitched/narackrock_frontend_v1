import type { ComponentType } from "react";
import { createBrowserRouter, type RouteObject } from "react-router";
import { AppProviders } from "./session";
import AppLayout from "@/app/app-layout";
import { RequireAuth } from "@/features/auth/require-auth";
import { pageRoutes, type PageId, type PageRoute } from "@/features/navigation/route-config";
import NotFoundPage from "@/app/not-found-page";
import HomePage from "@/features/home/pages/home-page";
import AbyssPage from "@/features/abyss/pages/abyss-page";
import ChartsPage from "@/features/home/pages/charts-page";
import PostsPage from "@/features/posts/pages/posts-page";
import PostPage from "@/features/posts/pages/post-page";
import CreatePostPage from "@/features/posts/pages/create-post-page";
import SocialPage from "@/features/social/pages/social-page";
import JoinedPage from "@/features/community/pages/joined-page";
import CreateCommunityPage from "@/features/community/pages/create-community-page";
import CommunityPage from "@/features/community/pages/community-page";
import CommunityAdminPage from "@/features/community/pages/community-admin-page";
import SourcesPage from "@/features/sources/pages/sources-page";
import SourcePage from "@/features/sources/pages/source-page";
import CreateSourcePage from "@/features/sources/pages/create-source-page";
import SearchPage from "@/features/search/pages/search-page";
import ProfilePage from "@/features/profile/pages/profile-page";
import EditProfilePage from "@/features/profile/pages/edit-profile-page";
import LoginPage from "@/features/auth/pages/login-page";
import OnboardingPage from "@/features/auth/pages/onboarding-page";
import SettingsPage from "@/features/settings/pages/settings-page";
import SavedPage from "@/features/saved/pages/saved-page";
import WorkspacePage from "@/features/workspace/pages/workspace-page";
import SubmissionsPage from "@/features/workspace/pages/submissions-page";
import SubmissionPage from "@/features/workspace/pages/submission-page";
import ReviewsPage from "@/features/workspace/pages/reviews-page";
import LibraryPage from "@/features/workspace/pages/library-page";
import StudioNewPage from "@/features/composition/pages/studio-new-page";
import StudioPage from "@/features/composition/pages/studio-page";
import LayerChoicePage from "@/features/composition/pages/layer-choice-page";
import UploadPage from "@/features/composition/pages/upload-page";
import RecordPage from "@/features/composition/pages/record-page";
import NoteEditorPage from "@/features/composition/pages/note-editor-page";
import ChatPage from "@/features/social/pages/chat-page";
import NotificationsPage from "@/features/notifications/pages/notifications-page";
import AdminPage from "@/features/admin/pages/admin-page";

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
    const element = page.requiresAuth ? (
      <RequireAuth>
        <Component />
      </RequireAuth>
    ) : (
      <Component />
    );
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
