import assert from "node:assert/strict";
import test from "node:test";

import { loginWithGoogle } from "../../lib/api/auth.ts";
import { getProfile, updateProfile, updateProfileImage } from "../../lib/api/profile.ts";
import { decodeGoogleCredential } from "./google-identity.ts";

function credential(payload: Record<string, unknown>): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

test("decodes Google profile hints without treating them as authentication", () => {
  assert.deepEqual(
    decodeGoogleCredential(credential({ name: "테스트 사용자", picture: "https://example.com/avatar.png" })),
    { name: "테스트 사용자", picture: "https://example.com/avatar.png" },
  );
});

test("completes the initial profile after the first unified Google login", async () => {
  const originalFetch = globalThis.fetch;
  const requests: { url: string; init?: RequestInit }[] = [];
  const responses = [
    new Response(JSON.stringify({ success: true, message: "ok", data: {
      accessToken: "access-token",
      refreshToken: "refresh-token",
      tokenType: "Bearer",
      firstLogin: true,
      user: { userId: 7, nickname: "새사용자", profileImageUrl: null },
    } }), { status: 201, headers: { "Content-Type": "application/json" } }),
    new Response(JSON.stringify({ success: true, message: "ok", data: {
      nickname: "새사용자",
      primaryInstrument: "Piano",
      explanation: "첫 소개",
    } }), { status: 200, headers: { "Content-Type": "application/json" } }),
    new Response(JSON.stringify({ success: true, message: "ok", data: {
      profileImageUrl: "/files/profiles/7/avatar.png",
    } }), { status: 200, headers: { "Content-Type": "application/json" } }),
    new Response(JSON.stringify({ success: true, message: "ok", data: {
      userId: 7,
      nickname: "새사용자",
      profileImageUrl: "/files/profiles/7/avatar.png",
      explanation: null,
      primaryInstrument: null,
      relations: { followerCount: 0, followingCount: 0, isFollowing: false },
      activities: { postCount: 0, posts: [], participatedShorts: [], pinnedShorts: [] },
    } }), { status: 200, headers: { "Content-Type": "application/json" } }),
  ];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), init });
    return responses.shift()!;
  };

  try {
    const image = new File(["avatar"], "avatar.png", { type: "image/png" });
    const login = await loginWithGoogle("google-id-token");
    assert.equal(login.firstLogin, true);
    await updateProfile({ nickname: "새사용자", primaryInstrument: "Piano", explanation: "첫 소개" });
    await updateProfileImage(image);
    const profile = await getProfile(login.user.userId);

    assert.equal(profile.nickname, "새사용자");
    assert.equal(profile.profileImageUrl, "/files/profiles/7/avatar.png");
    assert.equal(requests[0].url, "/api/v1/auth/login/google");
    assert.equal(requests[1].url, "/api/v1/users/me/profile");
    assert.equal(new Headers(requests[1].init?.headers).get("Authorization"), "Bearer access-token");
    assert.equal(requests[2].url, "/api/v1/users/me/profile/image");
    assert.ok(requests[2].init?.body instanceof FormData);
    assert.equal(requests[3].url, "/api/v1/users/profiles/7");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
