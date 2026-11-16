import test from "node:test";
import assert from "node:assert/strict";
import type { MidiNoteDto } from "../../lib/api/composition.ts";
import {
  nearestPianoSample,
  pianoRenderLength,
  pianoSampleName,
  pianoVoice,
  scheduleMidiEnvelope,
} from "./piano-render-plan.ts";

const note = (pitch: number, startTick: number, durationTick: number, velocity = 127) =>
  ({ pitch, startTick, durationTick, velocity, effectType: null, effectParams: {} }) as MidiNoteDto;

test("piano render picks the nearest sample, the lower one on a tie", () => {
  assert.deepEqual(
    [21, 22, 23, 30, 31, 42, 60].map(nearestPianoSample),
    [21, 21, 24, 24, 36, 36, 48],
  );
  assert.deepEqual([21, 24, 36, 48].map(pianoSampleName), ["A0", "C1", "C2", "C3"]);
});

test("piano render voices shift the sample and time notes in 480-tick quarters", () => {
  const { tickSeconds, durationSeconds } = pianoRenderLength(
    [note(60, 0, 480), note(62, 480, 960)],
    120,
  );
  assert.equal(durationSeconds, 1.5);
  const voice = pianoVoice(note(50, 480, 240, 127), tickSeconds);
  assert.deepEqual(voice, {
    start: 0.5,
    end: 0.75,
    velocity: 1,
    sample: 48,
    playbackRate: 2 ** (2 / 12),
    frequency: 440 * 2 ** ((50 - 69) / 12),
  });
});

test("piano render rejects empty and over-long note lists with the web's messages", () => {
  assert.throws(() => pianoRenderLength([], 120), /노트를 추가해주세요/);
  assert.throws(() => pianoRenderLength([note(60, 0, 480 * 121)], 120), /1분 이하/);
});

test("piano envelope ramps in over 10 ms and out over 80 ms", () => {
  const calls: [string, number, number][] = [];
  scheduleMidiEnvelope(
    {
      setValueAtTime: (value, time) => calls.push(["set", value, time]),
      linearRampToValueAtTime: (value, time) => calls.push(["ramp", value, time]),
    },
    1,
    2,
    0.5,
  );
  assert.deepEqual(calls, [
    ["set", 0, 1],
    ["ramp", 0.5, 1.01],
    ["set", 0.5, 1.92],
    ["ramp", 0, 2],
  ]);
});
