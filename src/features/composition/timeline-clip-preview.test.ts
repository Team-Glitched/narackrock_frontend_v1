import assert from "node:assert/strict";
import test from "node:test";
import { midiPreviewNotes } from "./midi-preview-notes.ts";
import { waveformPeaks } from "./waveform-peaks.ts";

function samples(channels: number[][]) {
  return {
    sampleRate: 1_000,
    numberOfChannels: channels.length,
    length: channels[0].length,
    getChannelData: (index: number) => Float32Array.from(channels[index]),
  };
}

test("MIDI preview uses clip-local timing and places higher pitches higher", () => {
  const notes = midiPreviewNotes([
    { pitch: 60, startTick: 0, durationTick: 120 },
    { pitch: 67, startTick: 360, durationTick: 240 },
    { pitch: 100, startTick: 480, durationTick: 120 },
  ], 480);
  assert.deepEqual(notes.map(({ startTick, durationTick }) => [startTick, durationTick]), [
    [0, 120],
    [360, 120],
  ]);
  assert.ok(notes[1].y < notes[0].y);
  assert.equal(midiPreviewNotes([{ pitch: 60, startTick: 0, durationTick: 120 }], 480)[0].y, 16);
  assert.deepEqual(midiPreviewNotes([], 480), []);
});

test("audio preview uses the trimmed range and the louder channel in each bucket", () => {
  const buffer = samples([
    [1, 1, 0, 0.25, 0, 0, 1, 1],
    [1, 1, 0, 0, -0.5, 0, 1, 1],
  ]);
  assert.deepEqual(waveformPeaks(buffer, 2, 2, 4), [0.5, 1]);
});

test("audio preview preserves silence and the empty tail beyond the source file", () => {
  assert.deepEqual(waveformPeaks(samples([[0, 0, 0, 0]]), 2), [0, 0]);
  assert.deepEqual(waveformPeaks(samples([[1, 0, 1, 0]]), 2, 2, 4), [1, 0]);
});
