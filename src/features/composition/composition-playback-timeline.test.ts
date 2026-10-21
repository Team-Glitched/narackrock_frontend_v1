import assert from "node:assert/strict";
import test from "node:test";
import { compositionEndMs } from "./composition-playback-timeline.ts";
import type { CompositionDto } from "../../lib/api/composition.ts";

test("drum playback includes the sample tail and respects project duration", () => {
  const composition = {
    project: { bpm: 120, ppq: 480, maxDurationMs: 4_000 },
    tracks: [{ instrument: "drum-kit", clips: [{
      clipType: "MIDI", startTick: 0,
      midiNotes: [{ startTick: 480, durationTick: 120 }],
    }] }],
  } as CompositionDto;

  assert.equal(compositionEndMs(composition, composition.tracks), 2_000);
  composition.project.maxDurationMs = 1_000;
  assert.equal(compositionEndMs(composition, composition.tracks), 1_000);
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
