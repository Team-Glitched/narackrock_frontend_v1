import { createBrowserRouter, type RouteObject } from "react-router";
import { AppProviders } from "./providers";
import { AppRuntime } from "./runtime";
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
import NotificationsPage from "@/features/notifications/pages/notifications-page";
import LikedPostsPage from "@/features/profile/pages/liked-posts-page";
import PrivacyPage from "@/features/settings/pages/privacy-page";

export const appRoutes: RouteObject[] = [{
  path: "/",
  HydrateFallback: () => <p role="status">화면을 불러오는 중...</p>,
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
    { path: "communities/:galleryId/manage", lazy: async () => ({ Component: (await import("@/features/community/pages/community-admin-page")).default }) },
    { path: "communities/:galleryId/members", lazy: async () => ({ Component: (await import("@/features/community/pages/community-members-page")).default }) },
    { path: "communities/manage", lazy: async () => ({ Component: (await import("@/features/community/pages/owned-communities-page")).default }) },
    { path: "sources", element: <SourcesPage /> },
    { path: "sources/:sourceId", element: <SourcePage /> },
    { path: "sources/:sourceId/comments", element: <SourcePage /> },
    { path: "sources/new", element: <CreateSourcePage /> },
    { path: "search", element: <SearchPage /> },
    { path: "profile", element: <ProfilePage /> },
    { path: "users/:userId", element: <ProfilePage /> },
    { path: "profile/edit", element: <EditProfilePage /> },
    { path: "profile/likes", element: <LikedPostsPage /> },
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
    { path: "studio/new", lazy: async () => ({ Component: (await import("@/features/composition/pages/studio-new-page")).default }) },
    { path: "studio/:projectId", lazy: async () => ({ Component: (await import("@/features/composition/pages/studio-page")).default }) },
    { path: "studio/shorts/:shortId", lazy: async () => ({ Component: (await import("@/features/composition/pages/studio-page")).default }) },
    { path: "studio/:projectId/layers/new", lazy: async () => ({ Component: (await import("@/features/composition/pages/layer-choice-page")).default }) },
    { path: "studio/:projectId/upload", lazy: async () => ({ Component: (await import("@/features/composition/pages/upload-page")).default }) },
    { path: "studio/:projectId/record", lazy: async () => ({ Component: (await import("@/features/composition/pages/record-page")).default }) },
    { path: "studio/:projectId/tracks/:trackId/notes", lazy: async () => ({ Component: (await import("@/features/composition/pages/note-editor-page")).default }) },
    { path: "studio/:projectId/import", lazy: async () => ({ Component: (await import("@/features/composition/pages/import-source-page")).default }) },
    { path: "chat", lazy: async () => ({ Component: (await import("@/features/social/pages/chat-page")).default }) },
    { path: "notifications", element: <NotificationsPage /> },
    { path: "admin", lazy: async () => ({ Component: (await import("@/features/admin/pages/admin-page")).default }) },
    { path: "*", element: <NotFoundPage /> },
  ],
}];
export const router = createBrowserRouter(appRoutes);
