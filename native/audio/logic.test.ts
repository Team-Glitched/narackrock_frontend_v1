/// <reference types="node" />
// Runs in Node (scripts/run-tests.mjs); the app's tsconfig includes no Node types otherwise.
import assert from "node:assert/strict";
import test from "node:test";

import type { TrackDto } from "../../src/lib/api/composition.ts";
import { buildPlaybackEvents } from "../../src/features/composition/composition-playback-timeline.ts";
import {
  audibleTracks,
  auditionWindow,
  base64ToBytes,
  bytesToBase64,
  clickSamples,
  closestSample,
  lookaheadSeconds,
  PlaybackSchedule,
  resolveUrl,
  trackLevel,
  type ScheduledAction,
} from "./logic.ts";

function track(trackId: number, extra: Partial<TrackDto> = {}): TrackDto {
  return {
    trackId,
    name: `track ${trackId}`,
    instrument: "piano",
    volume: 80,
    pan: 0,
    isMuted: false,
    isSolo: false,
    clips: [],
    ...extra,
  } as unknown as TrackDto;
}

test("sampler picks the nearest sample like Tone.Sampler, preferring the one above on a tie", () => {
  const piano = [21, 36, 48, 60];
  assert.deepEqual(closestSample(piano, 48), { sample: 48, playbackRate: 1 });
  assert.deepEqual(closestSample(piano, 50), { sample: 48, playbackRate: 2 ** (2 / 12) });
  assert.deepEqual(closestSample(piano, 46), { sample: 48, playbackRate: 2 ** (-2 / 12) });
  // 54 is 6 from both 48 and 60: the sample above wins.
  assert.deepEqual(closestSample(piano, 54), { sample: 60, playbackRate: 2 ** (-6 / 12) });
  assert.equal(closestSample(piano, 100)?.sample, 60);
  assert.equal(closestSample([], 60), null);
});

test("mixer levels follow project mute/solo, local mutes and local volumes", () => {
  const tracks = [track(1), track(2, { isSolo: true }), track(3, { isSolo: true, isMuted: true })];
  const mix = { trackVolumes: { 2: 55 }, mutedTrackIds: [] as number[] };
  assert.equal(trackLevel(tracks, tracks[0], mix), 0);
  assert.equal(trackLevel(tracks, tracks[1], mix), 55);
  assert.equal(trackLevel(tracks, tracks[2], mix), 0);
  assert.equal(trackLevel(tracks, tracks[1], { ...mix, mutedTrackIds: [2] }), 0);
  assert.deepEqual(
    audibleTracks(tracks).map((candidate) => candidate.trackId),
    [2],
  );
  const plain = [track(1), track(2, { isMuted: true })];
  assert.equal(trackLevel(plain, plain[0], { trackVolumes: {}, mutedTrackIds: [] }), 80);
  assert.deepEqual(
    audibleTracks(plain).map((candidate) => candidate.trackId),
    [1],
  );
});

const composition = {
  project: { bpm: 120, ppq: 480, maxDurationMs: 60_000 },
  tracks: [
    track(1, {
      clips: [
        {
          clipType: "MIDI",
          startTick: 0,
          midiNotes: [
            { pitch: 60, startTick: 0, durationTick: 480, velocity: 100 },
            { pitch: 64, startTick: 960, durationTick: 480, velocity: 90 },
          ],
        },
      ],
    } as unknown as Partial<TrackDto>),
  ],
};

function run(schedule: PlaybackSchedule, times: number[], metronome = false): ScheduledAction[] {
  return times.flatMap((time) => schedule.tick(time, metronome));
}

test("schedule turns the timeline into lookahead attacks, exact releases, clicks and the end", () => {
  // Notes at 0–500 ms and 1000–1500 ms; the playback ends at 1500 ms.
  const events = buildPlaybackEvents(composition, 0, 1500);
  const schedule = new PlaybackSchedule(events, 10, 0, 1500, 500);
  const first = schedule.tick(10, true);
  assert.deepEqual(
    first.map((action) => [action.type, "at" in action ? action.at : null]),
    [
      ["attack", 10],
      ["click", 10],
    ],
  );
  // Release at 10.5 s is scheduled once it is within the lookahead, at its exact time.
  const later = run(schedule, [10.25, 10.31, 10.6, 10.81, 11.1], true);
  assert.deepEqual(
    later.map((action) => [action.type, "at" in action ? action.at : null]),
    [
      ["release", 10.5],
      ["click", 10.5],
      ["attack", 11],
      ["click", 11],
    ],
  );
  assert.ok(10.31 + lookaheadSeconds >= 10.5);
  // The beat at 1500 ms is the end: no click there, only the last release.
  assert.deepEqual(run(schedule, [11.31], true), [{ type: "release", event: events[3], at: 11.5 }]);
  assert.deepEqual(run(schedule, [11.4], true), []);
  assert.deepEqual(run(schedule, [11.5]), [{ type: "end" }]);
  assert.deepEqual(run(schedule, [11.6]), []);
});

test("schedule starting mid-note attacks at once and counts beats from the position", () => {
  const schedule = new PlaybackSchedule(
    buildPlaybackEvents(composition, 1200, 1500),
    5,
    1200,
    1500,
    500,
  );
  assert.equal(schedule.position(5.25), 1450);
  assert.equal(schedule.position(4), 1200);
  assert.equal(schedule.position(9), 1500);
  const actions = schedule.tick(5, true);
  assert.deepEqual(
    actions.map((action) => [action.type, "at" in action ? action.at : null]),
    [["attack", 5]],
  );
  assert.ok(Math.abs(schedule.endAt - 5.3) < 1e-9);
});

test("a disabled metronome still advances its beat", () => {
  const schedule = new PlaybackSchedule([], 0, 0, 2000, 500);
  assert.deepEqual(run(schedule, [0]), []);
  assert.deepEqual(
    run(schedule, [0.4], true).map((action) => action.type),
    ["click"],
  );
});

test("click is 40 ms of fading 1 kHz sine", () => {
  const data = clickSamples(1000 * 40);
  assert.equal(data.length, 1600);
  assert.equal(data[0], 0);
  assert.ok(Math.abs(data[10] - 0.15 * (1 - 10 / 1600)) < 1e-6);
});

test("audition windows follow the web's selection rules", () => {
  assert.deepEqual(auditionWindow(null, null, 3), { offset: 0, duration: 3 });
  assert.deepEqual(auditionWindow(500, 3050, 3), { offset: 0.5, duration: 2.5 });
  for (const [start, end] of [
    [-1, 1000],
    [3000, null],
    [1000, 1000],
    [0, 3200],
  ])
    assert.throws(() => auditionWindow(start, end, 3), /선택한 오디오 구간이 올바르지 않습니다/);
});

test("base64 round-trips large byte arrays and URLs resolve against the app origin", () => {
  const bytes = Uint8Array.from({ length: 100_000 }, (_, index) => (index * 7) % 256);
  const encoded = bytesToBase64(bytes);
  assert.equal(bytesToBase64(Uint8Array.from([77, 97, 110])), "TWFu");
  assert.deepEqual(base64ToBytes(encoded), bytes);
  const origin = "http://127.0.0.1:17173";
  assert.equal(resolveUrl(origin, "/files/a.wav"), `${origin}/files/a.wav`);
  assert.equal(resolveUrl(origin, "files/a.wav"), `${origin}/files/a.wav`);
  assert.equal(resolveUrl(origin, "https://api.example/a.wav"), "https://api.example/a.wav");
});
