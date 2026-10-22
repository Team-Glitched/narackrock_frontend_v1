import assert from "node:assert/strict";
import test from "node:test";
import { participantAudioSchedule } from "./participant-audio-schedule.ts";
import type { ParticipantTracks } from "../../lib/api/shorts.ts";

const audio = { clipType: "AUDIO", mediaUrl: "/voice.wav", startTimeMs: 2000, durationMs: 4000, clipOffsetMs: 500 };
const midi = { clipType: "MIDI", startTick: 0, midiNotes: [{ pitch: 61, startTick: 960, durationTick: 480, velocity: 127 }] };
const data = { shortId: 1, project: { bpm: 120, ppq: 480, maxDurationMs: 10000 }, tracks: [
  { ownerId: 1, instrument: "piano", volume: 50, pan: -50, isMuted: false, isSolo: false, clips: [audio, midi] },
  { ownerId: 2, instrument: "piano", volume: 100, isMuted: false, isSolo: false, clips: [audio] },
] } as ParticipantTracks;

test("unselected users never contribute audio; all sources share timeline offsets", () => {
  const sounds = participantAudioSchedule(data, [1], 0);
  assert.equal(sounds.length, 2);
  assert.equal(sounds[0].startMs, 2000);
  assert.equal(sounds[0].offsetMs, 500);
  assert.equal(sounds[0].gain, .5);
  assert.equal(sounds[0].pan, -.5);
  assert.ok(Math.abs(sounds[1].startMs - 1000) < .001);
  assert.equal(sounds[1].url, "/audio/instruments/piano/60.mp3");
  assert.equal(sounds[1].rate, 2 ** (1 / 12));
});
test("seeking respects audio trim and excludes notes that already ended", () => {
  const sounds = participantAudioSchedule(data, [1], 3000);
  assert.equal(sounds.length, 1);
  assert.equal(sounds[0].startMs, 0);
  assert.equal(sounds[0].offsetMs, 1500);
  assert.equal(sounds[0].durationMs, 3000);
});
test("zero selection is silent, and solo state is evaluated before owner filtering", () => {
  assert.deepEqual(participantAudioSchedule(data, [], 0), []);
  const solo = { ...data, tracks: data.tracks.map((track, i) => ({ ...track, isSolo: i === 1 })) };
  assert.deepEqual(participantAudioSchedule(solo, [1], 0), []);
});
test("no source can play beyond the song end, including drum tails", () => {
  const clipped = { ...data, project: { ...data.project, maxDurationMs: 2500 } };
  assert.equal(participantAudioSchedule(clipped, [1], 2400)[0].durationMs, 100);
  assert.deepEqual(participantAudioSchedule(data, [1], 10000), []);
});
