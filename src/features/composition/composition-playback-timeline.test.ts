import assert from "node:assert/strict";
import test from "node:test";
import { compositionEndMs } from "./composition-playback-timeline.ts";
import type { CompositionDto } from "../../lib/api/composition.ts";

test("drum timeline ends at the entered note length and respects project duration", () => {
  const composition = {
    project: { bpm: 120, ppq: 480, maxDurationMs: 4_000 },
    tracks: [{ instrument: "drum-kit", clips: [{
      clipType: "MIDI", startTick: 0,
      midiNotes: [{ startTick: 480, durationTick: 120 }],
    }] }],
  } as CompositionDto;

  assert.equal(Math.round(compositionEndMs(composition, composition.tracks)), 625);
  composition.project.maxDurationMs = 600;
  assert.equal(compositionEndMs(composition, composition.tracks), 600);
});

test("pitched playback ends at note release", () => {
  const composition = {
    project: { bpm: 120, ppq: 480, maxDurationMs: 4_000 },
    tracks: [{ instrument: "piano", clips: [{
      clipType: "MIDI", startTick: 0,
      midiNotes: [{ startTick: 480, durationTick: 120 }],
    }] }],
  } as CompositionDto;

  assert.equal(Math.round(compositionEndMs(composition, composition.tracks)), 625);
});


test("mixed tracks stop at the latest actual MIDI or audio end, ignoring empty clip padding", () => {
  const composition = {
    project: { bpm: 120, ppq: 480, maxDurationMs: 60_000 },
    tracks: [{ instrument: "piano", clips: [
      { clipType: "MIDI", startTick: 960, durationTick: 50_000,
        midiNotes: [{ startTick: 480, durationTick: 480 }] },
      { clipType: "MIDI", startTick: 40_000, durationTick: 10_000, midiNotes: [] },
      { clipType: "AUDIO", startTimeMs: 500, durationMs: 3_000, clipOffsetMs: 10_000 },
    ] }],
  } as CompositionDto;
  assert.equal(compositionEndMs(composition, composition.tracks), 3_500);
  composition.tracks[0].clips.pop();
  assert.equal(compositionEndMs(composition, composition.tracks), 2_000);
  assert.equal(compositionEndMs(composition, []), 0);
});
