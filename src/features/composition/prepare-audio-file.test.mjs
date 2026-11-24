import assert from "node:assert/strict";
import { test } from "node:test";
import { prepareAudioFile } from "./prepare-audio-file.ts";

function fakeAudio(durationSeconds) {
  const calls = { start: null, starts: [], frames: null };
  globalThis.AudioContext = class {
    async decodeAudioData() {
      return { duration: durationSeconds };
    }
    async close() {}
  };
  globalThis.OfflineAudioContext = class {
    constructor(_channels, frames) {
      calls.frames = frames;
    }
    createBufferSource() {
      return {
        buffer: null,
        connect() {},
        start(...args) {
          calls.start = args;
          calls.starts.push(args);
        },
      };
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
    get destination() {
      return {};
    }
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

test("splices multiple ordered segments sequentially into one WAV", async () => {
  const calls = fakeAudio(30);
  const file = new File(["audio"], "cut-take.mp3", { type: "audio/mpeg" });

  const result = await prepareAudioFile(file, {
    startMs: 1_000,
    endMs: 18_000,
    segments: [
      { startMs: 1_000, endMs: 5_000 },
      { startMs: 12_000, endMs: 18_000 },
    ],
  });

  assert.equal(result.durationMs, 10_000);
  assert.equal(result.wav.name, "cut-take.wav");
  assert.equal(result.wav.size, 44 + 10 * 44_100 * 4);
  assert.deepEqual(calls.starts, [
    [0, 1, 4],
    [4, 12, 6],
  ]);
});

test("rejects spliced segments whose combined length exceeds one minute", async () => {
  fakeAudio(120);
  const file = new File(["audio"], "long-splice.mp3", { type: "audio/mpeg" });

  await assert.rejects(
    () =>
      prepareAudioFile(file, {
        startMs: 0,
        endMs: 90_000,
        segments: [
          { startMs: 0, endMs: 35_000 },
          { startMs: 50_000, endMs: 80_000 },
        ],
      }),
    /1분/,
  );
});
