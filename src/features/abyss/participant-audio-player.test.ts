import assert from "node:assert/strict";
import test from "node:test";
import { ParticipantAudioPlayer, type ParticipantPlaybackState } from "./participant-audio-player.ts";
import type { ParticipantTracks } from "../../lib/api/shorts.ts";

const data = { shortId: 1, project: { bpm: 120, ppq: 480, maxDurationMs: 10000 }, tracks: [
  { ownerId: 1, volume: 80, pan: 0, instrument: null, isMuted: false, isSolo: false,
    clips: [{ clipType: "AUDIO", mediaUrl: "/audio.wav", startTimeMs: 2000, durationMs: 4000, clipOffsetMs: 500 }] },
  { ownerId: 2, volume: 100, pan: 0, instrument: null, isMuted: false, isSolo: false,
    clips: [{ clipType: "AUDIO", mediaUrl: "/other.wav", startTimeMs: 1000, durationMs: 2000, clipOffsetMs: 0 }] },
] } as ParticipantTracks;

function fakeAudio() {
  const sources: { starts: number[][]; stops: number[]; connect: () => void; disconnect: () => void }[] = [];
  const gain = { gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {}, disconnect() {} };
  const context = {
    currentTime: 10, destination: {}, resume: async () => {}, close: async () => {},
    decodeAudioData: async () => ({ duration: 20 }),
    createGain: () => gain,
    createStereoPanner: () => ({ pan: { value: 0 }, connect() {}, disconnect() {} }),
    createBufferSource: () => {
      const source = { buffer: null, playbackRate: { value: 1 }, starts: [] as number[][], stops: [] as number[],
        connect() {}, disconnect() {}, start(...args: number[]) { this.starts.push(args); }, stop(time = 0) { this.stops.push(time); } };
      sources.push(source); return source;
    },
  };
  return { context, sources, gain };
}

test("sources start on a single audio clock; pause stops scheduled audio and preserves position", async () => {
  const audio = fakeAudio();
  let state: ParticipantPlaybackState | undefined;
  const original = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = async input => { urls.push(String(input)); return new Response(new ArrayBuffer(4)); };
  const player = new ParticipantAudioPlayer(next => { state = next; }, () => {}, () => audio.context as unknown as AudioContext);
  try {
    await player.play(data, [1], 0, 6000);
    assert.deepEqual(urls, ["/audio.wav"]);
    assert.deepEqual(audio.sources[0].starts[0], [12.04, .5]);
    player.setMuted(true); assert.equal(audio.gain.gain.value, 0);
    audio.context.currentTime = 11.04;
    player.pause();
    assert.equal(state!.playing, false);
    assert.ok(Math.abs(state!.positionMs - 1000) < .01);
    assert.equal(audio.sources[0].stops.at(-1), 0);
    await player.play(data, [1], 3000, 6000);
    assert.equal(urls.length, 1, "decoded audio is reused on seek");
    assert.equal(audio.sources[1].starts[0][1], 1.5);
  } finally { player.dispose(); globalThis.fetch = original; }
});

test("pausing while audio downloads prevents a late playback from starting", async () => {
  const audio = fakeAudio();
  const original = globalThis.fetch;
  let release: ((response: Response) => void) | undefined;
  globalThis.fetch = () => new Promise(resolve => { release = resolve; });
  const player = new ParticipantAudioPlayer(() => {}, () => {}, () => audio.context as unknown as AudioContext);
  try {
    const playing = player.play(data, [1], 0, 6000);
    await new Promise(resolve => setImmediate(resolve));
    player.pause();
    release!(new Response(new ArrayBuffer(4)));
    await playing;
    assert.equal(audio.sources.length, 0);
  } finally { player.dispose(); globalThis.fetch = original; }
});

test("audio download failure is visible and leaves every source stopped", async () => {
  const audio = fakeAudio();
  const original = globalThis.fetch;
  let state: ParticipantPlaybackState | undefined;
  globalThis.fetch = async () => new Response(null, { status: 404 });
  const player = new ParticipantAudioPlayer(next => { state = next; }, () => {}, () => audio.context as unknown as AudioContext);
  try {
    await player.play(data, [1], 0, 6000);
    assert.equal(state!.playing, false);
    assert.equal(state!.loading, false);
    assert.match(state!.error!, /불러오지 못했습니다/);
    assert.equal(audio.sources.length, 0);
  } finally { player.dispose(); globalThis.fetch = original; }
});
