import assert from "node:assert/strict";
import test from "node:test";

import type { TrackDto } from "../../lib/api/composition.ts";
import {
  listenerDurationMs,
  normalizeOwnerSelection,
  ownerTracks,
  parsePlaybackMode,
  participantOwners,
  playbackModeKey,
  sameOwnerSelection,
  toggleOwner,
} from "./short-playback-state.ts";

const track = (trackId: number, ownerId: number, name: string): TrackDto => ({
  trackId,
  ownerId,
  name,
  instrument: null,
  volume: 100,
  pan: 0,
  isMuted: false,
  isSolo: false,
  approvalStatus: "APPROVED",
  clips: [],
});

test("unchecking one owner from the full mix keeps every other owner", () => {
  assert.deepEqual([...toggleOwner(null, 2, [1, 2, 3])].sort(), [1, 3]);
  assert.deepEqual([...toggleOwner(new Set([1]), 3, [1, 2, 3])].sort(), [1, 3]);
});

test("selecting every owner with stems is the original mix, a subset or empty stays as chosen", () => {
  assert.equal(normalizeOwnerSelection(new Set([1, 2, 3]), [1, 2, 3, 2]), null);
  assert.deepEqual([...(normalizeOwnerSelection(new Set([2]), [1, 2, 3]) ?? [])], [2]);
  assert.equal(normalizeOwnerSelection(new Set(), [1, 2])?.size, 0);
  assert.equal(normalizeOwnerSelection(null, [1]), null);
  // A composer without approved stems does not block the full-mix normalization.
  assert.equal(normalizeOwnerSelection(new Set([1, 2]), [1, 2]), null);
  assert.equal(normalizeOwnerSelection(new Set([9]), []) !== null, true);
});

test("selection equality distinguishes the full mix from an explicit set", () => {
  assert.equal(sameOwnerSelection(null, null), true);
  assert.equal(sameOwnerSelection(null, new Set()), false);
  assert.equal(sameOwnerSelection(new Set([1, 2]), new Set([2, 1])), true);
  assert.equal(sameOwnerSelection(new Set([1]), new Set([1, 2])), false);
});

test("owners merge duplicated composer roles and add stem-only owners", () => {
  const owners = participantOwners(
    [
      { userId: 1, nickname: "A", profileImageUrl: null, role: "vocal" },
      { userId: 1, nickname: "A", profileImageUrl: null, role: "piano" },
      { userId: 1, nickname: "A", profileImageUrl: null, role: "vocal" },
    ],
    [track(2, 1, "A vocal"), track(3, 2, "B guitar"), track(4, 4, "D drums"), track(5, 2, "B guitar")],
    [{ userId: 2, nickname: "parityB" }],
  );
  assert.deepEqual(owners.map((owner) => [owner.userId, owner.nickname, owner.roles, owner.trackNames]), [
    [1, "A", ["vocal", "piano"], ["A vocal"]],
    [2, "parityB", [], ["B guitar"]],
    [4, "참여자 4", [], ["D drums"]],
  ]);
});

test("owner filtering keeps only the chosen owners' tracks", () => {
  const tracks = [track(2, 1, "a"), track(3, 2, "b"), track(4, 4, "d"), track(5, 5, "e")];
  assert.deepEqual(ownerTracks(tracks, new Set([4, 5])).map((item) => item.trackId), [4, 5]);
  assert.deepEqual(ownerTracks(tracks, new Set()), []);
});

test("listener length follows the original metadata within the project limit", () => {
  assert.equal(listenerDurationMs(20_500, 60_000), 20_500);
  assert.equal(listenerDurationMs(90_000, 60_000), 60_000);
  assert.equal(listenerDurationMs(null, 60_000), 60_000);
  assert.equal(listenerDurationMs(Number.NaN, 60_000), 60_000);
  assert.equal(listenerDurationMs(0, 60_000), 60_000);
});

test("playback mode falls back to repeat for missing or invalid stored values", () => {
  assert.equal(parsePlaybackMode("next"), "next");
  assert.equal(parsePlaybackMode("repeat"), "repeat");
  assert.equal(parsePlaybackMode(null), "repeat");
  assert.equal(parsePlaybackMode("NEXT"), "repeat");
  assert.equal(parsePlaybackMode('"next"'), "repeat");
});

test("playback mode is stored per API origin and account", () => {
  assert.equal(
    playbackModeKey("http://127.0.0.1:18081", 1001),
    "narackrock.abyss-playback:v1:http%3A%2F%2F127.0.0.1%3A18081:1001",
  );
  assert.equal(playbackModeKey("https://api.example", null), "narackrock.abyss-playback:v1:https%3A%2F%2Fapi.example:guest");
  assert.notEqual(playbackModeKey("https://api.example", 1), playbackModeKey("https://api.example", 2));
});
