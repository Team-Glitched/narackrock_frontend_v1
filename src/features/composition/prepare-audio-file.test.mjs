import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareAudioFile } from "./prepare-audio-file.ts";

function fakeAudio(durationSeconds) {
  const calls = { start: null, frames: null };
  globalThis.AudioContext = class {
    async decodeAudioData() { return { duration: durationSeconds }; }
    async close() {}
  };
  globalThis.OfflineAudioContext = class {
    constructor(_channels, frames) { calls.frames = frames; }
    createBufferSource() {
      return { buffer: null, connect() {}, start(...args) { calls.start = args; } };
    }
    async startRendering() {
      const empty = new Float32Array(calls.frames);
      return {
        length: calls.frames,
        sampleRate: 44_100,
        numberOfChannels: 2,
        getChannelData: () => empty,
      };
    }
    get destination() { return {}; }
  };
  return calls;
}

test("extracts only the selected part of a long audio file", async () => {
  const calls = fakeAudio(130);
  const file = new File(["audio"], "original.mp3", { type: "audio/mpeg" });

  const result = await prepareAudioFile(file, { startMs: 75_000, endMs: 105_000 });

  assert.equal(result.durationMs, 30_000);
  assert.equal(result.wav.name, "original.wav");
  assert.equal(result.wav.size, 44 + 30 * 44_100 * 4);
  assert.deepEqual(calls.start, [0, 75, 30]);
});

test("still requires a selection when the original exceeds one minute", async () => {
  fakeAudio(90);
  const file = new File(["audio"], "original.mp3", { type: "audio/mpeg" });

  await assert.rejects(() => prepareAudioFile(file), /1분/);
});

test("rejects a selection longer than one minute", async () => {
  fakeAudio(130);
  const file = new File(["audio"], "original.mp3", { type: "audio/mpeg" });

  await assert.rejects(() => prepareAudioFile(file, { startMs: 10_000, endMs: 71_000 }), /1분/);
});
