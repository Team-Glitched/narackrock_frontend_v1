import assert from "node:assert/strict";
import { test } from "node:test";
import {
  centerAudioSelection,
  moveAudioSelection,
  resizeAudioSelectionEnd,
  resizeAudioSelectionStart,
} from "./audio-trim-selection.ts";

test("moves the selection while preserving its length and clamping to the audio", () => {
  assert.deepEqual(moveAudioSelection({ startMs: 20_000, endMs: 50_000 }, 90_000, 100_000), {
    startMs: 70_000,
    endMs: 100_000,
  });
  assert.deepEqual(moveAudioSelection({ startMs: 20_000, endMs: 50_000 }, -90_000, 100_000), {
    startMs: 0,
    endMs: 30_000,
  });
});

test("resizes either handle within the one minute limit", () => {
  assert.deepEqual(resizeAudioSelectionStart({ startMs: 30_000, endMs: 90_000 }, 0), {
    startMs: 30_000,
    endMs: 90_000,
  });
  assert.deepEqual(resizeAudioSelectionEnd({ startMs: 30_000, endMs: 60_000 }, 95_000, 120_000), {
    startMs: 30_000,
    endMs: 90_000,
  });
});

test("centers the selection at a waveform position without crossing its edges", () => {
  assert.deepEqual(centerAudioSelection({ startMs: 0, endMs: 30_000 }, 95_000, 100_000), {
    startMs: 70_000,
    endMs: 100_000,
  });
});
