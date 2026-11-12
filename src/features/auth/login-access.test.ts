import assert from "node:assert/strict";
import test from "node:test";
import { loginDestination, requiresLogin } from "./login-access.ts";

test("requires a session for personal screens, profiles, creation, protected detail and notification overlays", () => {
  for (const path of [
    "/profile",
    "/profile/edit",
    "/profile/likes",
    // The profile API (`GET /users/profiles/:id`) requires a session, so other users' profiles do too.
    "/users/7",
    "/settings?migration=1",
    "/saved",
    "/workspace",
    "/submissions/7?projectId=2",
    "/reviews",
    "/library",
    "/friends",
    "/chat?userId=7",
    "/notifications",
    "/admin",
    "/sources",
    "/sources/new",
    "/studio/new",
    "/studio/7/tracks/8/notes?clipId=9",
    "/studio/shorts/4",
    "/posts/new?galleryId=7",
    "/communities/new",
    "/communities/joined",
    "/communities/manage",
    "/communities/7/manage",
    "/communities/7/members",
    "/charts?kind=mine",
    "/search?scope=people&q=name",
    "/search?scope=sources",
    "/?notifications=1",
  ])
    assert.equal(requiresLogin(path), true, path);
});

test("keeps home, public feeds, listening, policy and login available to guests", () => {
  for (const path of [
    "/",
    "/social",
    "/communities",
    "/communities/7",
    "/posts",
    "/posts/12",
    "/communities/7/posts/12?commentId=3",
    "/abyss",
    "/abyss/7",
    "/shorts/7",
    "/charts",
    "/charts?kind=popular",
    "/charts?kind=recommended",
    "/search?scope=songs",
    "/search?scope=posts",
    "/privacy",
    "/login",
    "/onboarding",
    "/?notifications=0",
  ])
    assert.equal(requiresLogin(path), false, path);
});

test("preserves the requested local page, query and hash after confirmation", () => {
  assert.deepEqual(loginDestination("/studio/shorts/4?tab=tracks#layer", "/abyss/4"), {
    returnTo: "/studio/shorts/4?tab=tracks#layer",
    from: "/abyss/4",
  });
});

test("never returns to an external URL supplied as a login destination", () => {
  for (const path of ["https://example.com", "//example.com/path", "/\\example.com"]) {
    assert.deepEqual(loginDestination(path, path), { returnTo: "/", from: "/" });
  }
});
