import assert from "node:assert/strict";
import test from "node:test";
import {
  audioPlaybackWindow,
  buildPlaybackEvents,
  compositionEndMs,
  drumTailMs,
  playbackEndMs,
  playbackEventIsDue,
  playbackHasEnded,
  stereoBalance,
} from "./composition-playback-timeline.ts";
import type { ClipDto, MidiNoteDto, TrackDto } from "../../lib/api/composition.ts";

function note(overrides: Partial<MidiNoteDto> = {}): MidiNoteDto {
  return { pitch: 60, startTick: 480, durationTick: 120, velocity: 100,
    effectType: null, effectParams: {}, ...overrides };
}

function clip(overrides: Partial<ClipDto> = {}): ClipDto {
  return { clipId: 1, ownerId: 1, clipType: "MIDI", sourceType: "MIDI_INPUT",
    mediaFileId: null, mediaUrl: null, startTick: 0, durationTick: 960,
    startTimeMs: 0, durationMs: 1_000, clipOffsetMs: 0, approvalStatus: "APPROVED",
    midiNotes: [note()], ...overrides };
}

function track(overrides: Partial<TrackDto> = {}): TrackDto {
  return { trackId: 1, ownerId: 1, name: "piano", instrument: "piano", volume: 100,
    pan: 0, isMuted: false, isSolo: false, approvalStatus: "APPROVED",
    clips: [clip()], ...overrides };
}

function composition(tracks = [track()], maxDurationMs = 4_000) {
  return { project: { bpm: 120, ppq: 480, maxDurationMs }, tracks };
}

test("drum timeline ends at the entered note length and respects project duration", () => {
  const input = composition([track({ instrument: "drum-kit" })]);
  assert.equal(compositionEndMs(input, input.tracks), 625);
  assert.equal(drumTailMs, 1_450);
  input.project.maxDurationMs = 600;
  assert.equal(compositionEndMs(input, input.tracks), 600);
});

test("pitched playback ends at note release", () => {
  const input = composition();
  assert.equal(compositionEndMs(input, input.tracks), 625);
});

test("mixed tracks stop at the latest actual MIDI or audio end, ignoring empty clip padding", () => {
  const input = composition([track({ clips: [
    clip({ startTick: 960, durationTick: 50_000, midiNotes: [note({ durationTick: 480 })] }),
    clip({ startTick: 40_000, durationTick: 10_000, midiNotes: [] }),
    clip({ clipType: "AUDIO", startTick: 480, startTimeMs: 500, durationMs: 3_000, clipOffsetMs: 10_000 }),
  ] })], 60_000);
  assert.equal(compositionEndMs(input, input.tracks), 3_500);
  input.tracks[0].clips.pop();
  assert.equal(compositionEndMs(input, input.tracks), 2_000);
  assert.equal(compositionEndMs(input, []), 0);
});

test("MIDI events include clip position, velocity, and paired unique voice identities", () => {
  const input = composition([track({ trackId: 17, clips: [
    clip({ startTick: 960, midiNotes: [note({ durationTick: 480, velocity: 0 })] }),
    clip({ startTick: 960, midiNotes: [note({ durationTick: 480, velocity: 127 })] }),
  ] })]);
  const events = buildPlaybackEvents(input, 0, 4_000);
  assert.deepEqual(events.map(({ type, atMs, trackId, pitch, velocity }) => ({ type, atMs, trackId, pitch, velocity })), [
    { type: "attack", atMs: 1_500, trackId: 17, pitch: 60, velocity: 0 },
    { type: "attack", atMs: 1_500, trackId: 17, pitch: 60, velocity: 127 },
    { type: "release", atMs: 2_000, trackId: 17, pitch: 60, velocity: 0 },
    { type: "release", atMs: 2_000, trackId: 17, pitch: 60, velocity: 127 },
  ]);
  assert.notEqual(events[0].voiceId, events[1].voiceId);
  assert.equal(events[0].voiceId, events[2].voiceId);
  assert.equal(events[1].voiceId, events[3].voiceId);
});

test("seek reattacks an overlapping pitched note for only its remaining duration", () => {
  const input = composition([track({ clips: [clip({
    startTick: 960, midiNotes: [note({ durationTick: 480 })],
  })] })]);
  assert.deepEqual(buildPlaybackEvents(input, 1_750, 4_000).map(({ type, atMs }) => ({ type, atMs })), [
    { type: "attack", atMs: 1_750 }, { type: "release", atMs: 2_000 },
  ]);
  assert.deepEqual(buildPlaybackEvents(input, 2_000, 4_000), []);
  assert.deepEqual(buildPlaybackEvents(input, 4_000, 4_000), []);
});

test("drum one-shots keep their tail beyond short notation but skip hits preceding seek", () => {
  const input = composition([track({ instrument: "DRUM", clips: [clip({ midiNotes: [
    note({ pitch: 36, startTick: 480, durationTick: 120 }),
    note({ pitch: 39, startTick: 960, durationTick: 120 }),
  ] })] })]);
  assert.deepEqual(buildPlaybackEvents(input, 0, 4_000).map(({ type, atMs, pitch }) => ({ type, atMs, pitch })), [
    { type: "attack", atMs: 500, pitch: 36 },
    { type: "attack", atMs: 1_000, pitch: 39 },
    { type: "release", atMs: 1_950, pitch: 36 },
    { type: "release", atMs: 2_450, pitch: 39 },
  ]);
  assert.deepEqual(buildPlaybackEvents(input, 750, 4_000).map(({ pitch }) => pitch), [39, 39]);
  assert.deepEqual(buildPlaybackEvents(input, 1_000, 4_000).map(({ type, atMs }) => ({ type, atMs })), [
    { type: "attack", atMs: 1_000 }, { type: "release", atMs: 2_450 },
  ]);
});

test("explicit transport end truncates both pitched notes and drum tails and excludes later attacks", () => {
  const input = composition([
    track({ clips: [clip({ midiNotes: [note({ durationTick: 1_920 }), note({ startTick: 960 })] })] }),
    track({ trackId: 2, instrument: "drum-kit" }),
  ]);
  const events = buildPlaybackEvents(input, 0, 1_000);
  assert.deepEqual(events.map(({ type, atMs }) => ({ type, atMs })), [
    { type: "attack", atMs: 500 }, { type: "attack", atMs: 500 },
    { type: "release", atMs: 1_000 }, { type: "release", atMs: 1_000 },
  ]);
});

test("releases sort before simultaneous attacks without merging their voices", () => {
  const input = composition([track({ clips: [clip({ midiNotes: [
    note({ startTick: 0, durationTick: 480 }), note({ startTick: 480, durationTick: 480 }),
  ] })] })]);
  const events = buildPlaybackEvents(input, 0, 4_000);
  assert.deepEqual(events.map(({ type, atMs }) => ({ type, atMs })), [
    { type: "attack", atMs: 0 }, { type: "release", atMs: 500 },
    { type: "attack", atMs: 500 }, { type: "release", atMs: 1_000 },
  ]);
  assert.notEqual(events[1].voiceId, events[2].voiceId);
});

test("lookahead schedules attacks but release eligibility follows raw context time exactly", () => {
  const events = buildPlaybackEvents(composition(), 0, 4_000);
  assert.equal(playbackEventIsDue(events[0], 10, 0, 10.5, 10.4), true);
  assert.equal(playbackEventIsDue(events[0], 10, 0, 10.499, 10.4), false);
  assert.equal(playbackEventIsDue(events[1], 10, 0, 10.7, 10.624999), false);
  assert.equal(playbackEventIsDue(events[1], 10, 0, 10.7, 10.625), true);
  assert.equal(playbackEventIsDue(events[1], 10, 500, 10.2, 10.124999), false);
  assert.equal(playbackEventIsDue(events[1], 10, 500, 10.2, 10.125), true);
});

test("AUDIO scheduling preserves nonzero clip start and trim offset before and across seek", () => {
  const audio = clip({ clipType: "AUDIO", startTick: 960, startTimeMs: 1_000,
    clipOffsetMs: 12_000, durationMs: 5_000 });
  assert.deepEqual(audioPlaybackWindow(audio, 0, 20), {
    delaySeconds: 1, offsetSeconds: 12, durationSeconds: 5,
  });
  assert.deepEqual(audioPlaybackWindow(audio, 3_000, 20), {
    delaySeconds: 0, offsetSeconds: 14, durationSeconds: 3,
  });
  assert.deepEqual(audioPlaybackWindow(audio, 1_000, 20), {
    delaySeconds: 0, offsetSeconds: 12, durationSeconds: 5,
  });
  assert.equal(audioPlaybackWindow(audio, 6_000, 20), null);
});

test("AUDIO scheduling clips duration to decoded buffer and never starts expired sources", () => {
  const audio = clip({ clipType: "AUDIO", clipOffsetMs: 12_000, durationMs: 5_000 });
  assert.deepEqual(audioPlaybackWindow(audio, 2_000, 15), {
    delaySeconds: 0, offsetSeconds: 14, durationSeconds: 1,
  });
  assert.equal(audioPlaybackWindow(audio, 3_000, 15), null);
  assert.equal(audioPlaybackWindow(audio, 0, 12), null);
  assert.equal(audioPlaybackWindow(audio, 5_000, 20), null);
  assert.equal(audioPlaybackWindow(clip(), 0, 20), null);
});

test("stereo balance preserves one channel and applies volume only once", () => {
  for (const volume of [0, 50, 100]) {
    const level = volume / 100;
    assert.deepEqual(stereoBalance(volume, -100), { left: level, right: 0 });
    assert.deepEqual(stereoBalance(volume, 0), { left: level, right: level });
    assert.deepEqual(stereoBalance(volume, 100), { left: 0, right: level });
  }
  assert.deepEqual(stereoBalance(50, 50), { left: 0.25, right: 0.5 });
  assert.deepEqual(stereoBalance(50, -50), { left: 0.5, right: 0.25 });
  assert.deepEqual(stereoBalance(50), { left: 0.5, right: 0.5 });
});

test("explicit duration uses the requested timeline even when content ends early", () => {
  const input = composition();
  assert.equal(playbackEndMs(input), 625);
  assert.equal(playbackEndMs(input, 3_000), 3_000);
  assert.equal(playbackEndMs(input, 8_000), 4_000);
  assert.equal(playbackEndMs(input, 0), 0);
  assert.equal(playbackEndMs(input, -1), 0);
  assert.equal(playbackEndMs(composition([]), 3_000), 3_000);
});

test("normal end follows raw context time and accounts for nonzero seek position", () => {
  assert.equal(playbackHasEnded(10, 1_000, 4_000, 12.999999), false);
  assert.equal(playbackHasEnded(10, 1_000, 4_000, 13), true);
  assert.equal(playbackHasEnded(10, 1_000, 4_000, 14), true);
  assert.equal(playbackHasEnded(10, 4_000, 4_000, 9.999999), false);
  assert.equal(playbackHasEnded(10, 4_000, 4_000, 10), true);
});
