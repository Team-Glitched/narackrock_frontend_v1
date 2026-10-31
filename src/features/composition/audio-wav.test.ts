import test from "node:test";
import assert from "node:assert/strict";
import { audioBufferToWav } from "./prepare-audio-file.ts";

function buffer(channels: number[][]): AudioBuffer {
  return {
    length: channels[0].length,
    sampleRate: 22050,
    numberOfChannels: channels.length,
    getChannelData: (channel: number) => Float32Array.from(channels[channel]),
  } as unknown as AudioBuffer;
}
test("WAV export has valid stereo PCM headers and interleaves channels", async () => {
  const file = audioBufferToWav(
    buffer([
      [0.25, 0],
      [-0.5, 1],
    ]),
    "piano.wav",
  );
  const bytes = await file.arrayBuffer();
  const view = new DataView(bytes);
  assert.equal(file.type, "audio/wav");
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
  assert.equal(new TextDecoder().decode(bytes.slice(8, 12)), "WAVE");
  assert.equal(view.getUint16(22, true), 2);
  assert.equal(view.getUint32(24, true), 22050);
  assert.equal(view.getUint32(40, true), 8);
  assert.equal(view.getInt16(44, true), Math.round(0.25 * 32767));
  assert.equal(view.getInt16(46, true), Math.round(-0.5 * 32767));
  assert.equal(view.getInt16(50, true), 32767);
});
test("mono audio is duplicated to stereo and clipped safely", async () => {
  const view = new DataView(await audioBufferToWav(buffer([[2, -2]]), "mono.wav").arrayBuffer());
  assert.equal(view.getInt16(44, true), 32767);
  assert.equal(view.getInt16(46, true), 32767);
  assert.equal(view.getInt16(48, true), -32767);
  assert.equal(view.getInt16(50, true), -32767);
});
