import { createBrowserRouter, type RouteObject } from "react-router";
import { AppProviders } from "./providers";
import { AppRuntime } from "./runtime";
import { RequireAuth } from "@/features/auth/require-auth";
import NotFoundPage from "@/features/navigation/pages/not-found-page";
import HomePage from "@/features/home/pages/home-page";
import AbyssPage from "@/features/abyss/pages/abyss-page";
import ShortLinkPage from "@/features/abyss/pages/short-link-page";
import ChartsPage from "@/features/home/pages/charts-page";
import PostsPage from "@/features/posts/pages/posts-page";
import PostPage from "@/features/posts/pages/post-page";
import CreatePostPage from "@/features/posts/pages/create-post-page";
import SocialPage from "@/features/social/pages/social-page";
import CommunitiesPage from "@/features/social/pages/communities-page";
import FriendsPage from "@/features/social/pages/friends-page";
import JoinedPage from "@/features/community/pages/joined-page";
import CreateCommunityPage from "@/features/community/pages/create-community-page";
import CommunityPage from "@/features/community/pages/community-page";
import CommunityAdminPage from "@/features/community/pages/community-admin-page";
import CommunityMembersPage from "@/features/community/pages/community-members-page";
import OwnedCommunitiesPage from "@/features/community/pages/owned-communities-page";
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
import ImportSourcePage from "@/features/composition/pages/import-source-page";
import ChatPage from "@/features/social/pages/chat-page";
import NotificationsPage from "@/features/notifications/pages/notifications-page";
import AdminPage from "@/features/admin/pages/admin-page";
import LikedPostsPage from "@/features/profile/pages/liked-posts-page";
import PrivacyPage from "@/features/settings/pages/privacy-page";

export const appRoutes: RouteObject[] = [{
  path: "/",
  element: <AppProviders><AppRuntime /></AppProviders>,
  children: [
    { index: true, element: <HomePage /> },
    { path: "abyss", element: <AbyssPage /> },
    { path: "abyss/:shortId", element: <AbyssPage /> },
    { path: "shorts/:shortId", element: <ShortLinkPage /> },
    { path: "charts", element: <ChartsPage /> },
    { path: "posts", element: <PostsPage /> },
    { path: "posts/:postId", element: <PostPage /> },
    { path: "posts/new", element: <CreatePostPage /> },
    { path: "social", element: <SocialPage /> },
    { path: "communities", element: <CommunitiesPage /> },
    { path: "friends", element: <FriendsPage /> },
    { path: "communities/joined", element: <JoinedPage /> },
    { path: "communities/new", element: <CreateCommunityPage /> },
    { path: "communities/:galleryId", element: <CommunityPage /> },
    { path: "communities/:galleryId/posts/:postId", element: <PostPage /> },
    { path: "communities/:galleryId/manage", element: <CommunityAdminPage /> },
    { path: "communities/:galleryId/members", element: <CommunityMembersPage /> },
    { path: "communities/manage", element: <OwnedCommunitiesPage /> },
    { path: "sources", element: <SourcesPage /> },
    { path: "sources/:sourceId", element: <SourcePage /> },
    { path: "sources/:sourceId/comments", element: <SourcePage /> },
    { path: "sources/new", element: <CreateSourcePage /> },
    { path: "search", element: <SearchPage /> },
    { path: "profile", element: <RequireAuth><ProfilePage /></RequireAuth> },
    { path: "users/:userId", element: <ProfilePage /> },
    { path: "profile/edit", element: <RequireAuth><EditProfilePage /></RequireAuth> },
    { path: "profile/likes", element: <RequireAuth><LikedPostsPage /></RequireAuth> },
    { path: "login", element: <LoginPage /> },
    { path: "onboarding", element: <OnboardingPage /> },
    { path: "settings", element: <SettingsPage /> },
    { path: "privacy", element: <PrivacyPage /> },
    { path: "saved", element: <SavedPage /> },
    { path: "workspace", element: <WorkspacePage /> },
    { path: "submissions", element: <SubmissionsPage /> },
    { path: "submissions/:submissionId", element: <SubmissionPage /> },
    { path: "reviews", element: <ReviewsPage /> },
    { path: "library", element: <LibraryPage /> },
    { path: "studio/new", element: <StudioNewPage /> },
    { path: "studio/:projectId", element: <StudioPage /> },
    { path: "studio/shorts/:shortId", element: <StudioPage /> },
    { path: "studio/:projectId/layers/new", element: <LayerChoicePage /> },
    { path: "studio/:projectId/upload", element: <UploadPage /> },
    { path: "studio/:projectId/record", element: <RecordPage /> },
    { path: "studio/:projectId/tracks/:trackId/notes", element: <NoteEditorPage /> },
    { path: "studio/:projectId/import", element: <ImportSourcePage /> },
    { path: "chat", element: <ChatPage /> },
    { path: "notifications", element: <NotificationsPage /> },
    { path: "admin", element: <AdminPage /> },
    { path: "*", element: <NotFoundPage /> },
  ],
}];
export const router = createBrowserRouter(appRoutes);
