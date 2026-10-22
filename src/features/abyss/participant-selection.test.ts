import assert from "node:assert/strict";
import test from "node:test";
import { participantSelection, participantRole, selectParticipantTracks } from "./participant-selection.ts";

const people = [{ userId: 1 }, { userId: 2 }, { userId: 1 }];
test("first visit checks every participant once; reopening keeps the selection", () => {
  assert.deepEqual(participantSelection(people, null), [1, 2]);
  assert.deepEqual(participantSelection(people, [2]), [2]);
  assert.deepEqual(participantSelection(people, []), []);
});
test("unknown and departed participants do not become selected", () => {
  assert.deepEqual(participantSelection(people, [2, 9]), [2]);
});
test("roles show selected instruments without changing unknown legacy roles", () => {
  assert.equal(participantRole("piano, acoustic-guitar"), "피아노 · 어쿠스틱 기타");
  assert.equal(participantRole("보컬"), "보컬");
  assert.equal(participantRole("EDITOR"), "작곡 참여");
  assert.equal(participantRole("AUDIO"), "오디오");
});
test("partial listening includes only selected owners and retains the full song timeline", () => {
  const composition = { project: { bpm: 120, ppq: 480, maxDurationMs: 60000 }, tracks: [
    { trackId: 1, ownerId: 1, clips: [{ ownerId: 1 }] },
    { trackId: 2, ownerId: 2, clips: [{ ownerId: 2 }] },
    { trackId: 3, ownerId: 2, clips: [{ ownerId: 2 }] },
  ] };
  const selected = selectParticipantTracks(composition, [2]);
  assert.deepEqual(selected.tracks.map(track => track.trackId), [2, 3]);
  assert.equal(selected.project.maxDurationMs, 60000);
  assert.deepEqual(selectParticipantTracks(composition, []).tracks, []);
});
